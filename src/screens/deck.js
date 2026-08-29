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
import {
  layoutWords, visibleWordCount, revealDuration, blinkAlpha,
} from '../core/textReveal.js';
import {
  computeOracleLayout, drawOracleBody, drawOracleEyes, headerBottomY as oracleHeaderBottomY,
} from '../core/oracle.js';
import { CARD_W, CARD_H } from '../core/cardRender.js';

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

// Каскад карт — «как в Виндовс-Косынке при победе» (правка в чате). Первая
// версия поднимала каждую карту локально, вдоль её же угла — выглядело
// как лёгкий подскок на месте, а не тасовка. По новой правке (2026-08-23:
// «карты пролетают через экран, своеобразная тасовка») все карты стартуют
// из ОДНОЙ и той же точки — угол и радиус животного момента появления
// (elapsed=0) у всех совпадают, так что визуально это одна стопка в
// центре, которая раздаёт себя веером по одной карте (см. CASCADE_STAGGER
// ниже и цикл отрисовки).
const CARDS_START = SUBTITLE_START + SUBTITLE_FADE + 0.3;
const CASCADE_STAGGER = 0.09;
const CASCADE_DURATION = 0.6;
const CASCADE_STACK_OFFSET = 260; // насколько «стопка» ближе к оси, чем FAN_RADIUS

// Карта в вере — тот же ФИКСИРОВАННЫЙ размер CARD_W×CARD_H (224×384), что
// и на экранах 3–4 (BUILD-SPEC-03 задача 2). Один визуальный объект держит
// один размер во всех сценах — иначе на переходе 2→3 карта скачком меняет
// размер (баг из чата 2026-08-23: «карта из колоды всё равно меняет свой
// размер... сохраняй текущие размеры»). Раньше было w×0.5 (зависело от
// экрана). Раскладка веера подстраивается под карту, а не наоборот: если
// карты сильнее перекрываются или срезаются краем — это нормально,
// разрешено явно («можешь наложить больше карты друг на друга»).

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
// Правка в чате 2026-08-30: после фиксации размера карты (задача 2) веер
// «стал скудным и чуть кривым, карты близко к тексту». Дуга у́же и радиус
// больше — веер собранный и мельче по вертикали; ряды ближе; вся
// композиция опущена ниже под шапку.
const FAN_RADIUS = 680;
const FAN_ANGLE_TOTAL = (30 * Math.PI) / 180;

// Доля высоты экрана, не константный пиксельный разнос (правка в чате,
// 2026-08-24: «верхний уровень карты колоды можно чуть поднять, чтобы
// заполнить пространство» — между подписью и задним рядом было слишком
// пусто на 390×844). Задний ряд стоит на FAN_RADIUS + ROW_GAP — его верх
// не зависит от размера карты (см. cardCenterAt: при angle=0 верх заднего
// ряда = h×CENTER_CARD_TOP_FRAC − ROW_GAP), только от этой доли и от
// высоты шапки, поэтому доля даёт одинаковый визуальный запас на всех
// вьюпортах — фиксированный пиксельный разнос заполнял пространство
// хорошо на 390×844, но на 320×568 упирался в шапку.
//
// 0.225 → 0.30 (BUILD-SPEC-03, задача 1) — второй плейтест: пустоты между
// подписью и веером всё ещё многовато, второй ряд разнесён с первым
// заметнее, вместе со смещением по углу (см. layoutCards) читается как
// зубец, а не просто «повыше».
const ROW_GAP_FRAC = 0.22;

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
//
// BUILD-SPEC-03 предполагал 0.58 → 0.50 (вместе с увеличенным ROW_GAP_FRAC
// поднятие одного только заднего ряда просто переехало бы пустоту вниз,
// под весь веер). На живом результате это не подтвердилось дважды: (1) на
// 320×568 задний ряд оказался ВЫШЕ подписи и рисовался поверх нее (голая
// математика: h×0.50−h×0.30 < высоты шапки на этом вьюпорте — не
// «пересечение на глаз», а реальный баг); (2) правка в чате, 2026-08-25:
// «опусти всю композицию ниже, можно обрезать низ нижнего ряда — главное
// расположить как было, внизу интерфейса». Возвращено 0.58 — выросшего
// ROW_GAP_FRAC (0.30 вместо 0.225) хватает, чтобы задний ряд всё равно
// стоял заметно ближе к подписи, чем до BUILD-SPEC-03, даже с прежним
// 0.58 у переднего ряда.
const CENTER_CARD_TOP_FRAC = 0.58;

// Наведённая карта чуть выходит из дуги наружу — вдоль своего же радиуса,
// а не просто вверх по Y, иначе на повёрнутых крайних картах подъём
// выглядел бы перекошенным (правка в чате: раньше пробовали и полный
// гарантированный зазор, и сдвиг соседей — оба читались «странно»;
// осталась только лёгкая радиальная подсказка, соседи не двигаются).
//
// BUILD-SPEC-03 предполагал 0.12 → 0.22 — заметнее приподнимается. На
// живом результате оказалось слишком много: у карт заднего ряда при
// подъёме на 0.22 снизу вылезал нижний край акцентной рамки (правка в
// чате, 2026-08-25: «ту мач»). Остановились на 0.17 — заметнее оригинала,
// но без вылезающего края. Порядок отрисовки НЕ меняем: наведённая карта
// по-прежнему может быть частично закрыта соседней справа —
// подтверждённое решение пользователя (2026-08-24), не чинить по своей
// инициативе.
const LIFT_FRAC = 0.17;
const SPREAD_RATE = 14; // скорость лерпа подъёма

// Вылет выбранной карты к позиции экрана 3 (то же место, что и в
// draw.js: половина ширины экрана, по центру по вертикали) — правка в
// чате: «плавно вылететь и встать в позицию третьего интерфейса», а не
// резким переключением сцены. Была 0.45h, потом 0.364h — попросили
// медленнее и плавнее, а затем (2026-08-23) — «карту чётко посередине
// экрана», формула здесь и в draw.js/reveal.js обновлены синхронно.
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
    const cardW = CARD_W;
    const cardH = CARD_H;
    const centerY = h * CENTER_CARD_TOP_FRAC + cardH / 2;
    pivotX = w / 2;
    pivotY = centerY + FAN_RADIUS;
    const rowGap = h * ROW_GAP_FRAC;

    // Оба ряда — один и тот же веер углов, слот = индекс внутри ряда
    // (i % ROW_COUNT); ряд = i < ROW_COUNT ? задний : передний. Задний
    // рисуется первым по естественному порядку индекса — передний ложится
    // поверх сам, без сортировки по слоям.
    //
    // Задний ряд смещён на angleStep/2 (BUILD-SPEC-03, задача 1) — не по
    // X: каждая карта повёрнута на свой угол, и сдвиг по прямой дал бы
    // перекос. Смещение ПО УГЛУ вместо этого выводит задние карты в
    // промежутки между передними — горизонтальный стык рядов читается как
    // зубец, а не сплошной шов.
    const angleStep = FAN_ANGLE_TOTAL / (ROW_COUNT - 1);
    const centerIndex = (ROW_COUNT - 1) / 2;
    for (let i = 0; i < CARD_COUNT; i++) {
      if (!cards[i]) cards[i] = { spreadR: 0 };
      const slot = i % ROW_COUNT;
      const row = Math.floor(i / ROW_COUNT); // 0 — задний, 1 — передний
      const backRowOffset = row === 0 ? angleStep * 0.35 : 0; // мягче зубца (правка 2026-08-30: «чуть криво»)
      cards[i].angle = (slot - centerIndex) * angleStep + backRowOffset;
      cards[i].radius = FAN_RADIUS + (ROWS - 1 - row) * rowGap;
      cards[i].w = cardW;
      cards[i].h = cardH;
      cards[i].delay = CARDS_START + i * CASCADE_STAGGER;
    }
  }

  /** Точка на дуге радиуса r при угле angle — полярные → экранные. Угол
   * передаётся отдельно (не читается с самой карты), чтобы во время
   * каскада можно было анимировать его независимо от финального угла
   * карты — см. вход веера ниже. */
  function cardCenterAt(angle, r) {
    return {
      x: pivotX + r * Math.sin(angle),
      y: pivotY - r * Math.cos(angle),
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
      const p = cardCenterAt(c.angle, c.radius);
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
          const p = cardCenterAt(c.angle, c.radius + c.spreadR);
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
      const subtitleFadeIn = clamp01((t - SUBTITLE_START) / SUBTITLE_FADE);
      if (subtitleFadeIn > 0) {
        // Мигать начинаем только после фейд-ина, не поверх него (правка
        // в чате: подпись «не читается», нужно мигание, чтобы удерживать
        // взгляд, — но не в момент, когда она и так проявляется).
        const subtitleAlpha = subtitleFadeIn >= 1
          ? blinkAlpha(t - (SUBTITLE_START + SUBTITLE_FADE))
          : subtitleFadeIn;
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
        // Точечное исключение из «imageSmoothingEnabled = false везде,
        // всегда» (CLAUDE.md) — сказано вслух, не втихую. Правило рассчитано
        // на спрайты, кратные родному арт-пикселю; эта карта — растровый PNG
        // 224×384, который здесь и повёрнут на произвольный угол, и
        // смасштабирован в произвольную (не кратную) долю ширины экрана —
        // ни то, ни другое пиксель-грид не выдерживает. С nearest-neighbor
        // это давало не пиксель-арт, а шум на тонкой штриховке (жалоба в
        // чате: «рябит, нечёткие пиксели»). Раньше тут была не PNG, а
        // ctx.strokeRect — векторная обводка, которую canvas сглаживает сам
        // независимо от этого флага, поэтому артефакта не было. Включаем
        // сглаживание только на время рисования самой карты — save/restore
        // уже оборачивают вызов, так что снаружи this функции правило
        // остаётся в силе без изменений.
        ctx.imageSmoothingEnabled = true;
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
        // тот же фиксированный размер CARD_W×CARD_H и там, и там, и та же
        // формула центрирования, чтобы при смене сцены не было скачка — и
        // выпрямляется по пути из своего угла на веере обратно в 0.
        const flyP = easeInOutQuad(clamp01((t - flyStartT) / FLY_DURATION));
        const targetX = Math.round((w - flyFrom.w) / 2);
        const targetY = Math.round((h - flyFrom.h) / 2);
        const x = flyFrom.x + (targetX - flyFrom.x) * flyP;
        const y = flyFrom.y + (targetY - flyFrom.y) * flyP;
        const rotation = flyFrom.rotation * (1 - flyP);

        ctx.globalAlpha = clamp01(1 - (t - flyStartT) / FLY_FADE_OTHERS);
        cards.forEach((c, i) => {
          if (i === hoveredIndex) return;
          const p = cardCenterAt(c.angle, c.radius);
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
      const stackRadius = FAN_RADIUS - CASCADE_STACK_OFFSET;
      cards.forEach((c, i) => {
        const elapsed = t - c.delay;
        let alpha = 1;
        let radius = c.radius + c.spreadR;
        let angle = c.angle;
        let rotation = c.angle;

        if (elapsed < 0) {
          alpha = 0;
        } else if (elapsed < CASCADE_DURATION) {
          // Angle и radius растут из ОБЩЕЙ точки стопки (angle=0,
          // stackRadius) до своих финальных значений одним и тем же p —
          // карта едет по прямой в полярных координатах, разворачиваясь
          // ровно по ходу движения, как будто её выкладывают веером из
          // руки, а не просто телепортируют с поворотом на месте.
          const p = easeOutBack(clamp01(elapsed / CASCADE_DURATION));
          radius = stackRadius + (c.radius - stackRadius) * p;
          angle = c.angle * p;
          rotation = angle;
        }

        if (alpha <= 0) return;
        const pos = cardCenterAt(angle, radius);
        ctx.globalAlpha = alpha;
        drawCard(pos.x, pos.y, c.w, c.h, rotation, i === hoveredIndex);
        ctx.globalAlpha = 1;
      });
    },
  };
}
