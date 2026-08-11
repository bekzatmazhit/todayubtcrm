const n="/logo.png";function o(){return`
    .watermark {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      opacity: 0.06;
      pointer-events: none;
      z-index: -1;
    }
    .watermark img {
      width: 600px;
      height: auto;
    }
    @media print {
      .watermark {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        opacity: 0.06;
        z-index: -1;
      }
      .watermark img {
        width: 600px;
        height: auto;
      }
    }
  `}function r(){return`<div class="watermark"><img src="${n}" alt="" /></div>`}function s(e,a,i){const t=window.open("","_blank");t&&(t.document.write(`<!DOCTYPE html><html><head><title>${e}</title>
    <style>
      @page { size: landscape; margin: 1cm; }
      body { margin: 20px; position: relative; }
      ${o()}
    </style></head><body>
    ${r()}
    ${a?`<p style="font-family:Arial,sans-serif;font-size:11px;color:#666;margin-bottom:16px;">${a}</p>`:""}
    ${i}
  </body></html>`),t.document.close(),t.print())}function l(e,a){const i=[[""],[""],[""],[""],["","","","TODAY Education"],["","","","Учебный центр TODAY"],["","","",`Экспортировано: ${new Date().toLocaleDateString("ru-RU")} ${new Date().toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})}`],[""],["","","","Данный документ создан в системе TODAY CRM"]],t=e.utils.aoa_to_sheet(i);t["!cols"]=[{wch:5},{wch:5},{wch:5},{wch:40}],e.utils.book_append_sheet(a,t,"TODAY")}export{r as a,l as b,o as g,s as p};
