/**
 * Componente: HeaderComponent
 * Renderiza el encabezado institucional con logo oficial vectorial SVG de Grupo TDM.
 */
export function HeaderComponent(reporte) {
  return `
    <style>
      .header-main {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 2.5px solid var(--primary);
        padding-bottom: 12px;
        margin-bottom: 12px;
      }
      .header-logo-area {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 32%;
      }
      .logo-brand-text {
        display: flex;
        flex-direction: column;
      }
      .logo-brand-text .brand-title {
        font-weight: 900;
        color: var(--primary);
        font-size: 15px;
        letter-spacing: 0.8px;
      }
      .logo-brand-text .brand-sub {
        font-weight: 600;
        color: var(--text-muted);
        font-size: 8.5px;
        text-transform: uppercase;
        letter-spacing: 0.4px;
      }
      .header-title-area {
        text-align: center;
        flex: 1;
        padding: 0 10px;
      }
      .header-title-area h1 {
        margin: 0;
        font-size: 16.5px;
        font-weight: 900;
        color: var(--primary);
        letter-spacing: 0.6px;
        text-transform: uppercase;
      }
      .header-title-area .productora-tag {
        font-size: 10.5px;
        font-weight: 700;
        color: var(--text-dark);
        text-transform: uppercase;
        margin-top: 3px;
        letter-spacing: 0.3px;
      }
      .header-meta-area {
        text-align: right;
        width: 30%;
      }
      .report-id {
        font-family: 'JetBrains Mono', monospace;
        font-size: 15px;
        font-weight: 800;
        color: var(--text-dark);
        margin: 0;
        letter-spacing: 0.3px;
      }
      .report-date {
        font-size: 10px;
        color: var(--text-muted);
        margin-top: 3px;
        font-weight: 500;
      }
    </style>

    <div class="header-main">
      <div class="header-logo-area">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="99 88 826 842" style="width: 44px; height: 44px; flex-shrink:0;">
          <defs>
            <linearGradient id="tdmGrad" gradientUnits="userSpaceOnUse" x1="433.5" y1="929" x2="500" y2="94">
              <stop offset="0" stop-color="#3F51B5"/>
              <stop offset="1" stop-color="#3F51B5"/>
            </linearGradient>
          </defs>
          <path fill="url(#tdmGrad)" d="M501.29 94.22C502.23 94.18 503.17 94.14 504.11 94.12C610.95 90.39 714.86 129.47 792.76 202.68C874.77 279.04 922.28 385.41 924.41 497.45C927.94 610.9 886.34 721.12 808.73 803.95C735.84 880.85 628.02 926.37 522.38 929.03C415.75 931.76 312.19 893.19 233.33 821.37C147.09 742.19 103.37 637.2 99.56 521.11C97.15 417.07 135.16 308.02 205.34 230.91C285.17 143.21 383.61 99.15 501.29 94.22Z"/>
          <path fill="url(#tdmGrad)" d="M426.33 154.08C431.45 149.93 470.37 144.28 478.06 144.29C493.6 144.31 511.27 140.43 526.43 142.84L526.05 142.87C528.52 143.6 538.76 143.93 542.62 144.48L542.9 145.34C590.46 150.07 630.89 160.44 674.28 181.54C683.92 182.53 702.83 193.82 710.49 199.47C756.29 225.96 812.88 288.53 836.35 338.09C836.52 338.45 836.62 340.12 836.65 340.55C837.08 341.98 841.18 350.22 842.02 351.99C845.51 359.13 848.7 366.43 851.56 373.84C865.26 409.89 873.53 447.76 876.12 486.24C877.68 507.61 876.43 530.03 873.9 551.29C865.2 628.47 832.97 701.1 781.58 759.34C654.1 906.04 420.5 918.78 275.08 791.32C216.44 740.15 175.56 671.7 158.32 595.81C153.45 573.29 150.3 550.43 148.91 527.43C147.98 513.34 148.62 500.36 149.48 486.32C154.25 409.18 186.54 328.14 237.67 269.84C241.59 264.43 251.37 254.42 256.21 249.54C287.76 217.42 325.27 191.75 366.65 173.98C375.73 170.05 388.39 164.92 397.97 162.32C403.22 159.73 419.84 156.03 426.33 154.08Z"/>
          <path fill="#ffffff" d="M510.87 287.56C527.52 288.88 525.41 303.77 525.84 316.38C528.13 382.25 623.34 399.94 619.09 467.96C617.74 489.49 608.71 505.94 592.93 520.23C604.6 532.92 603.67 539.23 591.4 550.72C591.4 550.72 591.4 550.72 591.4 550.72C591.81 562.3 591.05 574.53 591.73 586.02C600.19 586.5 609.92 586.3 618.47 586.31C630.02 586.4 641.56 586.31 653.1 586.04C653.82 580.16 653.75 565.84 653.44 559.88C647.17 552.63 646.74 549.39 653.01 542.34C642.17 531.17 635.91 522.68 634.62 506.26C631.52 469.09 670.72 455.69 686.32 428.35C690.95 420.24 689.24 403.06 691.36 393.95C692.41 389.46 696.25 384.77 701.29 385.11C714.3 386 711.67 402.81 713.15 411.8C714.16 419.04 715.9 426.11 720.92 431.77C741.72 455.22 782.51 475.25 773.53 512.71C770.39 525.8 764.82 532.35 755.16 541.29C761.85 548.54 761.98 552.26 755.47 559.41C754.7 567.95 754.03 581.69 755.03 590.51L755.03 645.47C755.03 654.76 755.29 664.18 754.62 673.44C754.28 678.15 750.38 682.18 745.61 682.38C737.49 682.72 729.27 682.55 721.12 682.54L672.32 682.48L514.25 682.48L348.91 682.47L301.32 682.5C293.69 682.51 285.38 682.77 277.8 682.26C274.06 682.01 272.15 678.75 270.07 675.87C269.1 664.49 269.69 649.89 269.56 638.28C269.25 612.39 269.96 586.14 269.51 560.28C267.14 557.17 265.62 555.39 264.04 551.82C265.78 546.92 266.21 546.13 269.62 542.54C258.93 532.49 251.34 523.21 250.02 508.09C246.73 470.66 288.25 455.03 306.15 429.27C313.73 418.35 308.54 398.31 316.05 388.61C317.6 386.78 319.6 385.7 321.91 385.55C333.45 384.78 333.13 398.3 332.88 406.71C332.16 431.12 345.62 440.58 362.21 455.64C375.82 468 390.73 482.69 390.86 502.65C391.01 521.53 383.15 530.76 371.14 543.41C377.71 550.4 376.97 552.81 371.25 559.95C370.8 568.12 371.04 577.96 371.06 586.25C378.09 586.35 429.76 587.2 431.74 585.21C434.47 582.47 433.44 555.82 433.31 550.62L429.86 547.16C419.91 537.21 422.74 529.06 432.01 520.39C420.23 508.05 412.29 497.75 408.42 480.77C393.16 413.94 462.62 396.06 490.08 347.94C495.17 338.89 496.25 328.71 497.34 318.62C498.63 306.63 495.7 291.04 510.87 287.56Z"/>
        </svg>
        <div class="logo-brand-text">
          <span class="brand-title">GRUPO TDM</span>
          <span class="brand-sub">AUDITORÍA DE CALIDAD</span>
        </div>
      </div>

      <div class="header-title-area">
        <h1>${(function(tipo) {
          const t = (tipo || '').toUpperCase();
          if (t.includes('RONDA'))         return 'RONDA DE CALIDAD';
          if (t.includes('SEGUIMIENTO'))   return 'SEGUIMIENTO DE CALIDAD';
          if (t.includes('CONTRAMUESTRA')) return 'CONTRAMUESTRA DE CALIDAD';
          if (t.includes('APROBACION') || t.includes('APROBACIÓN')) return 'APROBACIÓN DE PLANTA';
          if (t.includes('AUDITORIA') || t.includes('AUDITORÍA'))   return 'AUDITORÍA DE CALIDAD';
          return tipo || 'REPORTE DE CALIDAD';
        })(reporte.tipoVisita)}</h1>
        <div class="productora-tag">${reporte.productora.replace(/^\d+\s*—\s*/, '')}</div>
      </div>

      <div class="header-meta-area">
        <div class="report-id">${reporte.idReporte}</div>
        <div class="report-date">${reporte.fecha}</div>
      </div>
    </div>
  `;
}
