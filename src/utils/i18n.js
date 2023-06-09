// namespaces
var dwv = dwv || {};

/**
 * Get the translated text.
 *
 * @param {string} key The key to the text entry.
 * @param {object} _options The translation options such as plural, context...
 * @returns {string|undefined} The translated text.
 */
dwv.i18n = function (key, _options) {
  // defaut expects something like 'unit.cm2'
  var unit = {
    mm: 'mm',
    cm2: 'cm²',
    degree: '°'
  };
  var props = key.split('.');
  if (props.length !== 2) {
    throw new Error('Unexpected translation key length.');
  }
  if (props[0] !== 'unit') {
    throw new Error('Unexpected translation key prefix.');
  }
  return unit[props[1]];
};
