// Экран 2 — «The deck offers itself…» Переход с экрана 1 показан прямо
// здесь (правки в чате, 2026-08-18): старая реплика гаснет и на её месте
// тем же словом-за-словом проявляется новый заголовок, фигура оракула
// уходит обратно в темноту, потом каскадом (как в выигрышной анимации
// Windows Solitaire) влетают карты и ложатся веером внизу экрана —
// оригинального размера PNG, внахлёст, как настоящая колода. Дальше —
// проведение пальцем по колоде: под пальцем карта поднимается и красится
// акцентом, соседние расступаются. Референс по финальной раскладке (без
// перехода и каскада — тех эффектов в макетах нет):
// docs/interfaces/Picking the card.png

import { session } from '../core/session.js';
import { setFont, wrapLines } from '../core/text.js';
import { layoutWords, visibleWordCount, revealDuration } from '../core/textReveal.js';
import { computeOracleLayout, drawOracleBody, drawOracleEyes } from '../core/oracle.js';

// Число карт в вере — чисто визуальное (правка в чате: сначала 5
// читалось «мало для колоды», подняли до 9, потом ещё раз попросили
// больше), с реальным банком карт не связано: какую ни коснись, в этой
// сборке всегда падает Шут (BUILD-SPEC).
const CARD_COUNT = 14;

// Текст, с которым игрок пришёл с экрана 1 (должен быть слово-в-слово
// тем же — это финальная реплика question.js) — гаснет тут же, на той
// же высоте, будто это один непрерывный текст, а не новый экран.
const OLD_TEXT = 'What is your question about?';
const NEW_TITLE = 'The deck offers itself…';
const SUBTITLE = 'PICK THE CARD. TRUST THE POOL.';

const OLD_FADE_OUT = 0.5;
const TITLE_START = OLD_FADE_OUT; // новый текст ждёт, пока старый погаснет — без нахлёста
const TITLE_REVEAL = revealDuration(NEW_TITLE.split(' ').length);
const SUBTITLE_START = TITLE_START + TITLE_REVEAL + 0.25;
const SUBTITLE_FADE = 0.35;

// Фигура уходит в темноту тем же слоем, что проявлялась на экране 1 —
// пиксельно, стягиваясь обратно к глазам (core/oracle.js, progress 1→0).
const ORACLE_CONCEAL_START = 0;
const ORACLE_CONCEAL = 1.2;
const ORACLE_CELL_SIZE = 4;

// Каскад карт — «как в Виндовс-Косынке при победе» (правка в чате):
// вылетают из центра пачкой, с нахлёстом по времени, и ложатся веером.
// Высота вылета — небольшая (не с верха экрана): иначе все пять карт
// одновременно летят через весь экран и наслаиваются друг на друга и на
// текст — читалось грязно, а не как каскад.
const CARDS_START = SUBTITLE_START + SUBTITLE_FADE + 0.3;
const CASCADE_STAGGER = 0.09;
const CASCADE_DURATION = 0.5;
const CASCADE_DROP_HEIGHT = 200;

const CARD_W_FRAC = 0.5; // как на экранах 3–4 — тот же размер карты насквозь

// Веер полукругом вместо плоского ряда (правка в чате, 2026-08-19:
// «колода не использует пространство экрана... закрутить полукругом и
// повернуть немного вбок»). Геометрия — полярная, вокруг точки-оси ниже
// экрана: центральная карта смотрит точно вверх (angle=0, самая высокая
// точка дуги), крайние расходятся в стороны на FAN_ANGLE_TOTAL/2 каждая
// и поворачиваются на свой угол — как раскрытая веером колода в руке.
// При таком числе карт крайние всё равно уходят за края экрана — это
// нормально для полной колоды (веер длиннее видимой области), непрозрачная
// подложка карты (ниже) не даёт им путаться друг с другом.
const FAN_RADIUS = 780;
const FAN_ANGLE_TOTAL = (62 * Math.PI) / 180;
const FAN_BOTTOM_MARGIN = 8; // от низа экрана до низа центральной (самой верхней) карты

// Наведённая карта чуть выходит из дуги наружу — вдоль своего же радиуса,
// а не просто вверх по Y, иначе на повёрнутых крайних картах подъём
// выглядел бы перекошенным (правка в чате: раньше пробовали и полный
// гарантированный зазор, и сдвиг соседей — оба читались «странно»;
// осталась только лёгкая радиальная подсказка, соседи не двигаются).
const LIFT_FRAC = 0.12;
const SPREAD_RATE = 14; // скорость лерпа подъёма

// Вылет выбранной карты к позиции экрана 3 (то же место, что и в
// draw.js: половина ширины экрана, y ≈ 0.364h) — правка в чате: «плавно
// вылететь и встать в позицию третьего интерфейса», а не резким
// переключением сцены. Была 0.45 — попросили медленнее и плавнее.
const FLY_DURATION = 0.9;
const FLY_FADE_OTHERS = 0.4; // остальные карты гаснут, чтобы не мешать

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function easeInOutQuad(x) {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

// Лёгкий перелёт с притормаживанием в конце — «приземление» карты.
function easeOutBack(x) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

export function createDeckScreen({ input, images, goto }) {
  let offHandlers = [];
  let t = 0;
  let cards = []; // {angle, w, h, spreadR, delay}
  let pivotX = 0;
  let pivotY = 0;
  let hoveredIndex = null;
  let cardsSettled = false;
  let selected = false; // выбор сделан, дальше не реагируем на ввод
  let flying = false;
  let flyStartT = 0;
  let flyFrom = null; // {x, y, rotation} — позиция и угол карты в момент выбора

  function layoutCards(w, h) {
    const cardW = Math.round(w * CARD_W_FRAC);
    const cardH = Math.round(cardW * (384 / 224));
    const centerY = h - FAN_BOTTOM_MARGIN - cardH / 2;
    pivotX = w / 2;
    pivotY = centerY + FAN_RADIUS;

    const angleStep = FAN_ANGLE_TOTAL / (CARD_COUNT - 1);
    const centerIndex = (CARD_COUNT - 1) / 2;
    for (let i = 0; i < CARD_COUNT; i++) {
      if (!cards[i]) cards[i] = { spreadR: 0 };
      cards[i].angle = (i - centerIndex) * angleStep;
      cards[i].w = cardW;
      cards[i].h = cardH;
      cards[i].delay = CARDS_START + i * CASCADE_STAGGER;
    }
  }

  /** Центр карты на дуге радиуса r при её угле — полярные → экранные. */
  function cardCenterAt(c, r) {
    return {
      x: pivotX + r * Math.sin(c.angle),
      y: pivotY - r * Math.cos(c.angle),
    };
  }

  function cardIndexAt(x, y) {
    // Ближайшая по 2D-расстоянию карта среди «домашних» слотов веера (при
    // radius=FAN_RADIUS, без подъёма) — не зависит от текущего
    // анимированного расступания, иначе слоты гуляли бы под пальцем.
    // Дуга повёрнутая, поэтому просто по X уже недостаточно точно.
    let best = null;
    let bestDist = Infinity;
    cards.forEach((c, i) => {
      const p = cardCenterAt(c, FAN_RADIUS);
      const d = Math.hypot(x - p.x, y - p.y);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    return best;
  }

  return {
    enter() {
      t = 0;
      cards = [];
      hoveredIndex = null;
      cardsSettled = false;
      selected = false;
      flying = false;
      flyFrom = null;

      offHandlers = [
        input.on('pressstart', (e) => {
          if (!cardsSettled || selected) return;
          hoveredIndex = cardIndexAt(e.x, e.y);
        }),
        input.on('pressmove', (e) => {
          if (!cardsSettled || selected) return;
          hoveredIndex = cardIndexAt(e.x, e.y);
        }),
        input.on('pressend', () => {
          if (!cardsSettled || selected || hoveredIndex === null) return;
          selected = true;
          flying = true;
          flyStartT = t;
          const c = cards[hoveredIndex];
          const p = cardCenterAt(c, FAN_RADIUS + c.spreadR);
          flyFrom = {
            x: p.x - c.w / 2, y: p.y - c.h / 2, w: c.w, h: c.h, rotation: c.angle,
          };
          session.cardId = 'fool'; // любая карта в этой сборке — Шут (BUILD-SPEC)
        }),
      ];
    },

    exit() {
      offHandlers.forEach((off) => off());
      offHandlers = [];
    },

    update(dt) {
      t += dt;

      if (flying) {
        if (t - flyStartT >= FLY_DURATION) goto('draw');
        return;
      }

      const allLanded = cards.length === CARD_COUNT
        && cards.every((c) => t >= c.delay + CASCADE_DURATION);
      if (allLanded) cardsSettled = true;

      cards.forEach((c, i) => {
        // Только радиальный подъём наведённой карты (вдоль её же угла на
        // дуге) — соседей не трогаем (правка в чате).
        const targetR = i === hoveredIndex ? c.h * LIFT_FRAC : 0;
        const rate = 1 - Math.exp(-SPREAD_RATE * dt);
        c.spreadR += (targetR - c.spreadR) * rate;
      });
    },

    draw(ctx, w, h) {
      ctx.fillStyle = '#111111';
      ctx.fillRect(0, 0, w, h);

      const scale = Math.min(Math.max(w / 430, 0.75), 1.25);
      const marginX = Math.round(53 * scale);
      const textMaxWidth = w - marginX * 2;

      const titleLH = setFont(ctx, 'title', scale);
      const oldLines = wrapLines(ctx, OLD_TEXT, textMaxWidth);
      const newLines = wrapLines(ctx, NEW_TITLE, textMaxWidth);
      const ty = Math.round(70 * scale); // тот же уровень, что и на экране 1
      // Подсказка — по числу строк НОВОГО заголовка (он остаётся), не по
      // максимуму со старым: тот виден всего 0.5с, а прежде подсказка
      // сидела ниже, чем нужно, «под запас» на лишнюю строку — казалась
      // слишком низкой (правка в чате: «текст с подсказкой повыше»).
      const headerBottomY = ty + newLines.length * titleLH + Math.round(9 * scale);

      // Старая реплика — гаснет; новый заголовок — тем же способом,
      // слово за словом, что и на экране 1.
      ctx.textAlign = 'left';
      ctx.fillStyle = '#FFFFFF';
      const oldAlpha = clamp01(1 - t / OLD_FADE_OUT);
      if (oldAlpha > 0) {
        ctx.globalAlpha = oldAlpha;
        oldLines.forEach((line, i) => ctx.fillText(line, marginX, ty + i * titleLH));
        ctx.globalAlpha = 1;
      }
      const elapsedTitle = t - TITLE_START;
      if (elapsedTitle >= 0) {
        const words = layoutWords(ctx, newLines, marginX, ty, titleLH);
        const shown = visibleWordCount(elapsedTitle, words.length);
        for (let i = 0; i < shown; i++) ctx.fillText(words[i].text, words[i].x, words[i].y);
      }

      const subtitleAlpha = clamp01((t - SUBTITLE_START) / SUBTITLE_FADE);
      if (subtitleAlpha > 0) {
        setFont(ctx, 'menuOption', scale); // тот же стиль/размер, что у опций на экране 1
        ctx.fillStyle = '#EBA331';
        ctx.globalAlpha = subtitleAlpha;
        ctx.fillText(SUBTITLE, marginX, headerBottomY);
        ctx.globalAlpha = 1;
      }

      // Оракул уходит обратно в темноту — тот же слой, что и на экране 1.
      const oracle = computeOracleLayout(w, headerBottomY, scale, images.futureTellerBody);
      const concealProgress = clamp01(1 - (t - ORACLE_CONCEAL_START) / ORACLE_CONCEAL);
      drawOracleBody(ctx, images, oracle, concealProgress, ORACLE_CELL_SIZE);
      drawOracleEyes(ctx, images, oracle, concealProgress);

      layoutCards(w, h);

      // Рисует рубашку карты с центром в (cx,cy), повёрнутую на rotation
      // (радианы) — чёрная подложка тем же приёмом, что и раньше: у
      // рубашки прозрачный фон (только линии), без подложки карты в вере
      // просвечивали бы друг сквозь друга вместо того, чтобы перекрывать.
      function drawCard(cx, cy, cw, ch, rotation, accent) {
        ctx.save();
        ctx.translate(Math.round(cx), Math.round(cy));
        ctx.rotate(rotation);
        const dx = Math.round(-cw / 2);
        const dy = Math.round(-ch / 2);
        ctx.fillStyle = '#000000';
        ctx.fillRect(dx, dy, cw, ch);
        ctx.drawImage(images.cardBack, dx, dy, cw, ch);
        if (accent) {
          ctx.strokeStyle = '#EBA331';
          ctx.lineWidth = Math.max(2, Math.round(2 * scale));
          ctx.strokeRect(dx + 1, dy + 1, cw - 2, ch - 2);
        }
        ctx.restore();
      }

      if (flying && flyFrom) {
        // Выбранная карта плавно летит к позиции экрана 3 (draw.js) —
        // тот же размер и та же формула центрирования, чтобы при смене
        // сцены не было скачка (правка в чате) — и выпрямляется по пути
        // из своего угла на веере обратно в 0, к обычной ориентации карты.
        const flyP = easeInOutQuad(clamp01((t - flyStartT) / FLY_DURATION));
        const targetX = Math.round((w - flyFrom.w) / 2);
        const targetY = Math.round(h * 0.364);
        const x = flyFrom.x + (targetX - flyFrom.x) * flyP;
        const y = flyFrom.y + (targetY - flyFrom.y) * flyP;
        const rotation = flyFrom.rotation * (1 - flyP);

        ctx.globalAlpha = clamp01(1 - (t - flyStartT) / FLY_FADE_OTHERS);
        cards.forEach((c, i) => {
          if (i === hoveredIndex) return;
          const p = cardCenterAt(c, FAN_RADIUS);
          drawCard(p.x, p.y, c.w, c.h, c.angle, false);
        });
        ctx.globalAlpha = 1;

        drawCard(x + flyFrom.w / 2, y + flyFrom.h / 2, flyFrom.w, flyFrom.h, rotation, true);
        return;
      }

      // Карты — каскадом влетают (разворачиваясь из центра в свой угол на
      // дуге), потом лежат веером полукругом внизу. Рисуем строго в
      // порядке индекса (естественный порядок стопки): карта правее лежит
      // «спереди» и рисуется позже, поэтому продолжает частично перекрывать
      // наведённую, если та приподнята недостаточно, чтобы выйти из-под
      // неё — так и должно быть (правка в чате: «она должна быть закрыта
      // всё равно спереди лежащей картой»).
      cards.forEach((c, i) => {
        const elapsed = t - c.delay;
        let alpha = 1;
        let radius = FAN_RADIUS + c.spreadR;
        let rotation = c.angle;

        if (elapsed < 0) {
          alpha = 0;
        } else if (elapsed < CASCADE_DURATION) {
          const p = easeOutBack(clamp01(elapsed / CASCADE_DURATION));
          radius = (FAN_RADIUS - CASCADE_DROP_HEIGHT) + CASCADE_DROP_HEIGHT * p;
          rotation = c.angle * p;
        }

        if (alpha <= 0) return;
        const pos = cardCenterAt(c, radius);
        ctx.globalAlpha = alpha;
        drawCard(pos.x, pos.y, c.w, c.h, rotation, i === hoveredIndex);
        ctx.globalAlpha = 1;
      });
    },
  };
}
