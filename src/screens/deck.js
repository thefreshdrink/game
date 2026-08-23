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
import {
  computeOracleLayout, drawOracleBody, drawOracleEyes, headerBottomY as oracleHeaderBottomY,
} from '../core/oracle.js';

// Число карт в вере — чисто визуальное (правка в чате: сначала 5
// читалось «мало для колоды», подняли до 9, потом ещё раз попросили
// больше), с реальным банком карт не связано: какую ни коснись, в этой
// сборке всегда падает Шут (BUILD-SPEC).
const CARD_COUNT = 20;

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

// Карта — 0.42 ширины экрана вместо 0.5 (BUILD-SPEC-02, задача 3): при
// половине ширины и радиусе дуги 780 крайние карты уходили полностью за
// края, а сама карта заслоняла собой слишком много ширины веера.
const CARD_W_FRAC = 0.42;

// Два ряда, не один (правка в чате, 2026-08-23: «карты нарисованы как-то
// не так... сделай два ряда, ничего страшного, если будут накладываться
// друг на друга»). CARD_COUNT делится ровно пополам: задний ряд — первая
// половина индексов, передний — вторая, поэтому естественный порядок
// отрисовки (по индексу) сам кладёт передний ряд поверх заднего, без
// отдельной сортировки по слоям. Оба ряда стоят на ОДНИХ И ТЕХ ЖЕ углах
// (не в шахматном порядке): задний ряд — тот же веер, но на большем
// радиусе от той же точки-оси, поэтому просто выглядывает из-за
// переднего сверху, а не путается с ним по горизонтали.
const ROWS = 2;
const ROW_COUNT = CARD_COUNT / ROWS;

// Веер полукругом вместо плоского ряда (правка в чате, 2026-08-19:
// «колода не использует пространство экрана... закрутить полукругом и
// повернуть немного вбок»). Геометрия — полярная, вокруг точки-оси ниже
// экрана: центральная карта смотрит точно вверх (angle=0, самая высокая
// точка дуги), крайние расходятся в стороны на FAN_ANGLE_TOTAL/2 каждая
// и поворачиваются на свой угол — как раскрытая веером колода в руке.
//
// Угол убавлен вдвое с лишним против прошлой правки (правка в чате:
// «оставляй лёгким полукругом, но не слишком сильно» — 76° уже читалось
// как перебор, особенно с двумя рядами сразу). FAN_RADIUS — радиус
// ПЕРЕДНЕГО (главного, интерактивного) ряда; задний — на ROW_GAP дальше
// от той же оси, то есть выше на экране (см. cardCenterAt).
const FAN_RADIUS = 620;
const FAN_ANGLE_TOTAL = (38 * Math.PI) / 180;
const ROW_GAP = 150;

// Верх центральной (самой верхней) карты ПЕРЕДНЕГО ряда — доля высоты
// экрана, не фиксированный пиксельный отступ от низа: после того как
// оракул уходит в темноту, веер должен занять освободившуюся пустоту
// (BUILD-SPEC-02, задача 3), а фиксированный отступ от низа не следил бы
// за этим на экранах разной высоты.
//
// Расхождение внутри самой задачи 3, зафиксировано вслух (правило
// CLAUDE.md): текст говорит «верх центральной карты на ~0.40h», а
// приёмка тут же требует «между подписью и верхом карты не больше
// ~0.12h пустоты» на 390×844. При 0.40h разрыв на этом вьюпорте выходит
// ~0.21h — вдвое больше цели приёмки, с текущей высотой шапки (заголовок
// + подпись) 0.40h просто слишком низко. Взята приёмка как измеримая —
// 0.30h держит разрыв ≈0.12h на 390×844, «около 0.40» не в счёт.
//
// Поднято до 0.58 (правка в чате, 2026-08-23: «опусти карты прям все
// вниз, можно даже срезать концы нижних карт») — после перехода на два
// ряда веер опустили вниз намеренно, вплоть до обрезки нижним краем
// экрана крайних карт дуги (они ниже центральной — cos(angle)<1 в
// cardCenterAt), это и есть «концы нижних карт», о которых речь.
const CENTER_CARD_TOP_FRAC = 0.58;

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

// Авто-фит текстовой подписи (BUILD-SPEC-02, задача 3): пробуем базовый
// кегль, потом уменьшаем шагами до 0.8 от базового; если и на 0.8 не
// влезло в maxWidth — переносим на две строки на этом же (0.8) кегле.
// ctx.font после вызова остаётся выставленным на menuOption/scale
// результата — вызывающему коду setFont звать заново не нужно.
function fitLabel(ctx, text, maxWidth, baseScale) {
  const steps = [1, 0.93, 0.86, 0.8];
  for (const step of steps) {
    const lineHeight = setFont(ctx, 'menuOption', baseScale * step);
    if (ctx.measureText(text).width <= maxWidth) {
      return { scale: baseScale * step, lines: [text], lineHeight };
    }
  }
  const scale = baseScale * 0.8;
  const lineHeight = setFont(ctx, 'menuOption', scale);
  return { scale, lines: wrapLines(ctx, text, maxWidth), lineHeight };
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
    const centerY = h * CENTER_CARD_TOP_FRAC + cardH / 2;
    pivotX = w / 2;
    pivotY = centerY + FAN_RADIUS;

    // Оба ряда — один и тот же веер углов, слот = индекс внутри ряда
    // (i % ROW_COUNT); ряд = i < ROW_COUNT ? задний : передний. Задний
    // рисуется первым по естественному порядку индекса — передний ложится
    // поверх сам, без сортировки по слоям.
    const angleStep = FAN_ANGLE_TOTAL / (ROW_COUNT - 1);
    const centerIndex = (ROW_COUNT - 1) / 2;
    for (let i = 0; i < CARD_COUNT; i++) {
      if (!cards[i]) cards[i] = { spreadR: 0 };
      const slot = i % ROW_COUNT;
      const row = Math.floor(i / ROW_COUNT); // 0 — задний, 1 — передний
      cards[i].angle = (slot - centerIndex) * angleStep;
      cards[i].radius = FAN_RADIUS + (ROWS - 1 - row) * ROW_GAP;
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
    // Ближайшая по 2D-расстоянию карта среди «домашних» слотов веера (на
    // СВОЁМ радиусе — задний и передний ряд стоят на разных, без подъёма),
    // не зависит от текущего анимированного расступания, иначе слоты
    // гуляли бы под пальцем. Дуга повёрнутая, поэтому просто по X уже
    // недостаточно точно.
    let best = null;
    let bestDist = Infinity;
    cards.forEach((c, i) => {
      const p = cardCenterAt(c, c.radius);
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
          const p = cardCenterAt(c, c.radius + c.spreadR);
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

      // Подпись — авто-фит по ширине (BUILD-SPEC-02, задача 3): на узких
      // экранах одной строкой на базовом кегле не влезала и обрезалась.
      // Уменьшаем кегль шагами до 0.8 от базового; если и это не помогло —
      // переносим на две строки (wrapLines).
      const subtitleFit = fitLabel(ctx, SUBTITLE, textMaxWidth, scale);
      const subtitleAlpha = clamp01((t - SUBTITLE_START) / SUBTITLE_FADE);
      if (subtitleAlpha > 0) {
        setFont(ctx, 'menuOption', subtitleFit.scale);
        ctx.fillStyle = '#EBA331';
        ctx.globalAlpha = subtitleAlpha;
        subtitleFit.lines.forEach((line, i) => {
          ctx.fillText(line, marginX, headerBottomY + i * subtitleFit.lineHeight);
        });
        ctx.globalAlpha = 1;
      }
      // Оракул уходит обратно в темноту — тот же слой, что и на экране 1.
      // Якорь — ФИКСИРОВАННЫЙ (core/oracle.js: headerBottomY), не от
      // фактического числа строк заголовка/подписи ЭТОГО экрана: на
      // экране 1 те же реплики иногда переносятся на 3 строки, здесь
      // заголовок всегда на 2 — от разной высоты шапки фигура «скакала»
      // между экранами (баг, пойман в чате). Подпись по-прежнему растёт
      // от headerBottomY (реального, не фиксированного) — ей нужно не
      // налезать на СВОЙ заголовок, а не совпадать с экраном 1.
      const oracle = computeOracleLayout(w, oracleHeaderBottomY(ty, titleLH, scale), scale, images.futureTellerBody);
      const concealProgress = clamp01(1 - (t - ORACLE_CONCEAL_START) / ORACLE_CONCEAL);
      drawOracleBody(ctx, images, oracle, concealProgress, ORACLE_CELL_SIZE);
      drawOracleEyes(ctx, images, oracle, concealProgress);

      layoutCards(w, h);

      // Рисует рубашку карты с центром в (cx,cy), повёрнутую на rotation
      // (радианы). Подложка — воздух сцены #111111, не тело #000000
      // (правка в чате, 2026-08-23): у рубашки прозрачный фон (только
      // линии), нужна какая-то заливка, чтобы карты не просвечивали друг
      // сквозь друга, но для самой карты фон должен сливаться со сценой,
      // не выделяться отдельным тёмным телом — тот же принцип, что уже
      // применён к лицевой стороне на экране 4. Рамка выбора — готовый
      // ассет (select_frame.png), не нарисованный ctx.strokeRect: она
      // чуть крупнее самой карты (228×388 против 224×384), обводка идёт
      // СНАРУЖИ, не по кромке.
      function drawCard(cx, cy, cw, ch, rotation, accent) {
        ctx.save();
        ctx.translate(Math.round(cx), Math.round(cy));
        ctx.rotate(rotation);
        const dx = Math.round(-cw / 2);
        const dy = Math.round(-ch / 2);
        ctx.fillStyle = '#111111';
        ctx.fillRect(dx, dy, cw, ch);
        ctx.drawImage(images.cardBack, dx, dy, cw, ch);
        if (accent) {
          const fw = Math.round(cw * (228 / 224));
          const fh = Math.round(ch * (388 / 384));
          ctx.drawImage(images.cardSelectFrame, Math.round(-fw / 2), Math.round(-fh / 2), fw, fh);
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
          const p = cardCenterAt(c, c.radius);
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
        let radius = c.radius + c.spreadR;
        let rotation = c.angle;

        if (elapsed < 0) {
          alpha = 0;
        } else if (elapsed < CASCADE_DURATION) {
          const p = easeOutBack(clamp01(elapsed / CASCADE_DURATION));
          radius = (c.radius - CASCADE_DROP_HEIGHT) + CASCADE_DROP_HEIGHT * p;
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
