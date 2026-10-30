/* Architectural contours follow the existing 1620 × 971 illustration.
 * No canvas, video, animation framework, frame loop or additional image request.
 */
const drawing = [
 // Perspective and foundations establish the street before the façades.
 ['ground',0,2.8,[
  'M12 666 L333 686 L550 711 L706 732 L879 765 L1104 822 L1528 945',
  'M28 700 L390 728 L728 800 L1194 964',
  'M52 759 L434 784 L853 931',
  'M158 699 L280 876 M331 710 L610 961 M506 728 L1040 969',
  'M2 734 L366 710 M45 817 L577 756 M191 904 L828 812',
 ]],
 ['outline',.2,2.3,[
  'M331 682 L331 583 L359 578 L359 559 L465 557 L486 585 L486 640',
  'M331 583 L441 583 L465 557 M441 583 L441 640',
  'M506 694 L506 517 L575 505 L675 516 L675 698',
  'M535 511 L535 487 L565 479 L646 487 L646 512 M535 487 L646 490',
  'M565 700 L565 553 L671 553 M565 603 L675 602 M565 650 L675 651',
 ]],
 ['outline',.65,2.5,[
  'M691 711 L691 555 L725 551 L725 459 L752 402 L856 415 L882 460 L882 608',
  'M725 459 L752 402 L778 454 L881 461 M778 454 L778 534',
  'M705 551 L705 539 L784 533 L872 544 L872 558',
  'M691 555 L784 552 L880 561 M784 552 L784 703',
  'M881 612 L881 431 L910 426 L910 411 L984 405 L992 408 L992 425 L1003 429',
  'M881 431 L992 424 L992 599',
 ]],
 ['outline',1.05,2.5,[
  'M1003 606 L1003 352 L1034 347 L1034 330 L1155 316 L1198 332',
  'M1003 355 L1164 338 L1198 350 M1034 330 L1161 318 L1164 338 L1164 484',
  'M1198 483 L1198 268 L1227 263 L1227 242 L1364 213 L1394 229 L1394 247',
  'M1198 268 L1368 237 L1473 283 L1473 335',
  'M1227 242 L1368 217 M1368 237 L1368 668',
  'M1368 298 L1498 345 L1498 696 M1368 298 L1368 237',
 ]],
 ['outline',1.45,2.35,[
  'M879 731 L879 647 L931 602 L982 652 L1050 647',
  'M879 647 L930 604 L1006 606 L1052 641 M982 652 L982 739',
  'M1050 751 L1050 590 L1128 586 L1128 512 L1266 497 L1362 512 L1362 688',
  'M1117 514 L1266 497 L1266 752 M1117 514 L1117 507 L1216 493',
  'M1150 503 L1150 485 L1265 473 L1355 486 L1355 511',
  'M1128 607 L1254 607 L1254 582 L1128 581 M1128 682 L1253 689 L1253 659 L1128 648',
  'M1049 758 L1246 792 L1246 776 L1064 744 M1118 752 L1118 514',
 ]],
 ['detail',.85,1.9,[
  'M342 610 V595 H352 V610 Z M363 608 V593 H373 V608 Z M384 608 V591 H397 V608 Z M420 609 V592 H431 V609 Z',
  'M342 639 V623 H352 V639 Z M363 639 V621 H376 V639 Z M389 639 V621 H406 V639 Z M421 640 V620 H432 V640 Z',
  'M343 676 V654 H353 V677 M362 678 V650 H377 V679 M391 681 V653 H405 V683 M422 680 V651 H433 V677',
  'M522 557 V534 L532 532 V557 Z M522 598 V574 L533 573 V597 Z M522 639 V617 L534 617 V640 Z',
  'M580 551 V530 L595 529 V552 M610 552 V529 L628 530 V553 M646 554 V532 L661 533 V554',
  'M579 595 V573 H594 V596 M609 595 V574 H627 V597 M647 595 V575 H662 V596',
  'M578 642 V619 H595 V642 M610 643 V619 H628 V643 M647 643 V621 H662 V644',
  'M576 691 V665 H597 V694 M613 695 V665 H634 V697 M650 694 V666 H663 V692',
 ]],
 ['detail',1.4,2,[
  'M747 450 V432 L754 431 V449 Z M735 495 V474 L745 472 V495 Z M753 493 V470 L765 469 V492 Z',
  'M792 491 V468 L813 470 V492 Z M841 493 V470 L864 473 V496 Z',
  'M735 533 V510 L746 509 V532 M755 533 V508 L766 508 V532 M791 534 V509 L813 511 V536 M841 539 V513 L862 515 V541',
  'M704 601 V573 H722 V601 Z M740 600 V571 H762 V600 Z M791 599 V571 H812 V599 Z M845 600 V572 H861 V600 Z',
  'M704 648 V621 H724 V648 Z M741 649 V619 H763 V649 Z M790 650 V620 H811 V650 Z M845 648 V619 H860 V647 Z',
  'M705 711 V671 L730 673 V715 M746 715 V670 H763 V704 M791 706 V671 H813 V700 M846 696 V667 H860 V690',
  'M901 481 V453 L920 451 V480 Z M901 534 V506 L919 504 V533 Z M902 587 V558 L920 557 V586 Z',
  'M947 477 V450 L969 448 V475 M934 478 L976 475 V488 L935 493 Z M948 529 V506 H968 V526 M934 530 L977 527 V540 L935 547 Z',
 ]],
 ['detail',1.9,2,[
  'M1023 413 V378 L1043 376 V413 Z M1023 474 V437 L1043 436 V473 Z M1024 531 V495 L1043 494 V530 Z M1025 587 V552 L1045 551 V586 Z',
  'M1063 416 V376 L1095 373 V414 M1121 412 V370 L1144 368 V411 M1055 420 L1148 410 V423 L1055 434 Z',
  'M1064 471 V437 L1095 434 V468 M1121 466 V433 L1143 430 V464 M1055 475 L1148 463 V476 L1055 487 Z',
  'M1065 525 V489 L1094 487 V522 M1056 530 L1118 523 V536 L1056 544 Z M1065 577 V554 L1089 552 V577',
  'M1217 325 V290 L1242 286 V322 Z M1267 317 V281 L1293 276 V314 Z M1319 308 V275 L1347 270 V306',
  'M1217 384 V350 L1243 346 V381 Z M1267 377 V343 L1293 339 V374 Z M1319 371 V339 L1347 334 V367',
  'M1217 443 V409 L1244 406 V441 Z M1268 438 V404 L1293 401 V436 Z M1319 431 V399 L1347 395 V429',
  'M1309 305 L1349 297 L1356 301 V324 L1310 332 Z M1307 367 L1349 359 L1356 362 V385 L1307 392 Z M1306 424 L1348 417 L1355 420 V443 L1306 449 Z',
  'M1387 307 V275 L1398 280 V311 M1421 320 V288 L1431 292 V324 M1450 331 V301 L1459 305 V335',
  'M1387 368 V337 L1398 341 V373 M1421 381 V350 L1431 354 V385 M1453 394 V363 L1463 367 V399 M1475 400 V371 L1483 375 V405',
  'M1387 433 V402 L1399 406 V437 M1421 444 V414 L1431 418 V448 M1453 457 V426 L1463 430 V461 M1476 466 V438 L1485 441 V470',
  'M1388 502 V469 L1401 473 V506 M1423 514 V482 L1433 485 V517 M1455 524 V493 L1465 496 V527',
  'M1388 576 V536 L1401 540 V578 M1425 577 V544 L1436 548 V581 M1456 581 V552 L1468 554 V585',
 ]],
 ['detail',2.3,1.8,[
  'M894 673 V654 H906 V674 Z M924 675 V653 H938 V676 Z M952 679 V658 H965 V680 Z M924 639 V624 H936 V641 Z',
  'M894 731 V696 H906 V732 M922 737 V697 H938 V739 M951 742 V702 H966 V745',
  'M1073 654 V613 H1097 V655 Z M1072 728 V684 H1095 V732',
  'M1140 578 V536 L1168 533 V578 Z M1200 578 V533 L1241 529 V578 Z',
  'M1139 650 V612 H1168 V654 M1196 655 V610 H1241 V661',
  'M1138 736 V688 H1166 V742 M1192 746 V692 H1235 V753',
  'M1288 581 V533 L1302 535 V582 Z M1326 583 V536 L1340 538 V584 Z M1287 661 V615 H1302 V660 Z M1327 658 V612 H1341 V657 Z',
  'M1051 728 L1243 762 V780 L1049 746 Z M1065 730 V748 M1081 733 V752 M1098 736 V755 M1116 739 V757 M1135 743 V760 M1154 746 V764 M1174 750 V768 M1195 754 V771 M1216 757 V775',
 ]],
 ['ground',2.7,1.9,[
  'M443 684 C423 676 439 665 433 660 C425 651 440 640 448 645 C444 628 467 631 472 642 C488 633 501 649 493 658 C510 668 497 680 482 680 M465 689 L462 656',
  'M802 728 C786 721 795 706 805 705 C799 692 818 687 823 698 C833 682 850 692 848 705 C864 706 863 720 848 726 M827 739 L826 708',
  'M1272 818 C1244 810 1245 788 1262 782 C1242 765 1259 745 1279 745 C1278 722 1309 719 1320 732 C1330 706 1357 718 1360 736 C1387 727 1402 750 1387 770 C1409 780 1395 802 1377 805 C1376 824 1350 832 1337 819 M1325 863 L1320 772 M1323 823 L1300 790 M1323 812 L1348 777',
 ]],
];

export function installEntryScene(root, win = window) {
 if (!root || root.dataset.sceneInstalled) return;
 root.dataset.sceneInstalled = 'true';
 const doc = root.ownerDocument, art = root.closest('.entry-art'), entry = root.closest('#moradaEntry');
 const image = root.querySelector('.entry-city-image');
 if (!art || !entry || !image) return;
 const reduced = win.matchMedia('(prefers-reduced-motion: reduce)');
 const ns = 'http://www.w3.org/2000/svg', svg = doc.createElementNS(ns, 'svg');
 svg.setAttribute('viewBox', '0 0 1620 971');
 svg.setAttribute('aria-hidden', 'true');svg.setAttribute('focusable', 'false');
 svg.classList.add('entry-city-lines');
 for (const [kind, delay, duration, paths] of drawing) {
  paths.forEach((d, i) => {
   const path = doc.createElementNS(ns, 'path');
   path.setAttribute('d', d);path.setAttribute('pathLength', '1');
   path.classList.add('entry-city-' + kind);
   path.style.setProperty('--draw-delay', (delay + i * .035) + 's');
   path.style.setProperty('--draw-duration', duration + 's');svg.append(path);
  });
 }
 root.querySelector('.entry-city-camera').append(svg);
 const toggle = doc.createElement('button');
 toggle.type = 'button';toggle.className = 'entry-motion-toggle';toggle.hidden = true;
 art.append(toggle);
 let userPaused = false, visible = true, prepared = false, disposed = false;
 const t = text => win.MoradaI18n?.t(text) || text;
 const complete = () => root.classList.add('is-complete');
 function sync() {
  if (disposed) return;
  if (reduced.matches || entry.hidden) complete();
  root.dataset.paused = String(userPaused || reduced.matches || doc.hidden || entry.hidden || !visible);
  toggle.hidden = reduced.matches || !prepared;
  const label = t(userPaused ? 'Animation fortsetzen' : 'Animation pausieren');
  toggle.setAttribute('aria-label', label);toggle.title = label;
  toggle.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="' + (userPaused ? 'M5 3 12 8 5 13Z' : 'M5 3v10M11 3v10') + '"/></svg>';
 }
 const onToggle = () => {userPaused = !userPaused;sync();};
 const onAnimationEnd = event => {if(event.animationName === 'morada-city-ink') complete();};
 toggle.addEventListener('click', onToggle);
 svg.addEventListener('animationend', onAnimationEnd);
 doc.addEventListener('visibilitychange', sync);
 win.addEventListener('morada:languagechange', sync);
 reduced.addEventListener('change', sync);
 const mutation = new win.MutationObserver(sync);
 mutation.observe(entry, {attributes:true, attributeFilter:['hidden']});
 const intersection = win.IntersectionObserver ? new win.IntersectionObserver(entries => {
  visible = entries[0]?.isIntersecting !== false;sync();
 }) : null;
 intersection?.observe(art);
 if (!reduced.matches) root.classList.add('is-preparing');
 sync();
 // Decode only the image already embedded in the page; no network prerequisite.
 Promise.resolve(image.decode?.()).catch(() => {}).then(() => {
  if (disposed) return;
  prepared = true;root.classList.remove('is-preparing');root.classList.add('is-ready');sync();
 });
 return () => {
  disposed = true;mutation.disconnect();intersection?.disconnect();
  doc.removeEventListener('visibilitychange', sync);win.removeEventListener('morada:languagechange', sync);
  reduced.removeEventListener('change', sync);toggle.remove();svg.remove();
  root.classList.remove('is-preparing','is-ready','is-complete');delete root.dataset.paused;delete root.dataset.sceneInstalled;
 };
}
if (typeof document !== 'undefined') installEntryScene(document.querySelector('#moradaEntry .entry-scene'));
