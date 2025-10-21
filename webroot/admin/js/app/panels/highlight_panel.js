import { $ } from '../../core/utils.js';
import { DEFAULTS } from '../../core/defaults.js';
import { uploadGeneric } from '../../core/upload.js';

export function createHighlightPanel({ getSettings, thumbFallback, updateFlamePreview }) {
  const renderHighlightBox = () => {
    const settings = getSettings();
    const hl = settings.highlightNext || DEFAULTS.highlightNext;

    $('#hlEnabled').checked = !!hl.enabled;
    $('#hlColor').value     = hl.color || DEFAULTS.highlightNext.color;
    $('#hlBefore').value    = Number.isFinite(+hl.minutesBeforeNext) ? hl.minutesBeforeNext : DEFAULTS.highlightNext.minutesBeforeNext;
    $('#hlAfter').value     = Number.isFinite(+hl.minutesAfterStart) ? hl.minutesAfterStart  : DEFAULTS.highlightNext.minutesAfterStart;

    const setSw = ()=> $('#hlSw').style.background = $('#hlColor').value;
    setSw();
    $('#hlColor').addEventListener('input',()=>{
      if(/^#([0-9A-Fa-f]{6})$/.test($('#hlColor').value)) setSw();
    });

    // Flammenbild
    $('#flameImg').value = settings.assets?.flameImage || DEFAULTS.assets.flameImage;
    const flameTf = settings.assets?.flameThumbFallback;
    updateFlamePreview(flameTf ? thumbFallback : $('#flameImg').value);

    $('#flameFile').onchange = ()=> uploadGeneric($('#flameFile'), (p, tp)=>{
      settings.assets = settings.assets || {};
      settings.assets.flameImage = p;
      settings.assets.flameThumbFallback = (tp === thumbFallback);
      $('#flameImg').value = p;
      updateFlamePreview(tp);
    });

    $('#resetFlame').onclick = ()=>{
      const def = DEFAULTS.assets.flameImage;
      settings.assets = settings.assets || {};
      settings.assets.flameImage = def;
      settings.assets.flameThumbFallback = false;
      $('#flameImg').value = def;
      updateFlamePreview(def);
    };
  }
  return { renderHighlightBox };
}
