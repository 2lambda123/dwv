/**
 * Tests for the 'math/shapes.js' file.
 */
// Do not warn if these variables were not defined before.
/* global QUnit */

/**
 * Tests for {@link dwv.math.Ellipse}.
 *
 * @function module:tests/math~Ellipse
 */
QUnit.test('Test Ellipse.', function (assert) {
  var center0 = new dwv.math.Point2D(0, 0);
  var e0 = new dwv.math.Ellipse(center0, 2, 4);
  // getCenter
  assert.equal(e0.getCenter(), center0, 'getCenter');
  // getA
  assert.equal(e0.getA(), 2, 'getA');
  // getB
  assert.equal(e0.getB(), 4, 'getB');

  // equals: true
  var e1 = new dwv.math.Ellipse(center0, 2, 4);
  assert.ok(e0.equals(e1), 'equal ellipses');
  // equals: false a
  var e20 = new dwv.math.Ellipse(center0, 3, 4);
  assert.notOk(e0.equals(e20), 'non equal ellipses a');
  // equals: false b
  var e21 = new dwv.math.Ellipse(center0, 2, 5);
  assert.notOk(e0.equals(e21), 'non equal ellipses b');
  // equals: false radius
  var center22 = new dwv.math.Point2D(1, 1);
  var e22 = new dwv.math.Ellipse(center22, 2, 4);
  assert.notOk(e0.equals(e22), 'non equal ellipses center');

  // getSurface
  assert.equal(e0.getSurface(), Math.PI * 2 * 4, 'getSurface');
  // equals: true
  assert.equal(e0.getWorldSurface(0.5, 0.25), Math.PI, 'getWorldSurface');
});

/**
 * Tests for {@link dwv.math.Ellipse} quantification.
 *
 * @function module:tests/math~Ellipse
 */
QUnit.test('Test Ellipse quantify.', function (assert) {
  var center0 = new dwv.math.Point2D(2, 2);
  var e0 = new dwv.math.Ellipse(center0, 1, 2);
  // view controller
  var mockVc0 = {
    canQuantifyImage: function () {
      return true;
    },
    get2DSpacing: function () {
      return [1, 1];
    },
    getCurrentPosition: function () {
      return new dwv.math.Index([0, 0, 0]);
    },
    getImageVariableRegionValues: function () {
      return [0, 1, 1, 0, 0, 1, 1, 0];
    }
  };
  var theoQuant0 = {
    min: {value: 0, unit: ''},
    max: {value: 1, unit: ''},
    mean: {value: 0.5, unit: ''},
    stdDev: {value: 0.5, unit: ''},
    surface: {value: 0.06283185307179587, unit: undefined}
  };
  var resQuant0 = e0.quantify(mockVc0);
  assert.equal(resQuant0.min.value, theoQuant0.min.value, 'quant min');
  assert.equal(resQuant0.max.value, theoQuant0.max.value, 'quant max');
  assert.equal(resQuant0.mean.value, theoQuant0.mean.value, 'quant mean');
  assert.equal(resQuant0.stdDev.value, theoQuant0.stdDev.value, 'quant stdDev');
  assert.equal(
    resQuant0.surface.value, theoQuant0.surface.value, 'quant surface');
});

/**
 * Tests for getEllipseIndices.
 *
 * @function module:tests/math~getEllipseIndices
 */
QUnit.test('Test getEllipseIndices.', function (assert) {
  var center00 = new dwv.math.Index([1, 1]);
  var radius00 = [2, 2];
  var dir00 = [0, 1];
  var theoRes = [];
  for (var i = 0; i <= radius00[0]; ++i) {
    for (var j = 0; j <= radius00[1]; ++j) {
      theoRes.push(new dwv.math.Index([i, j]));
    }
  }
  var indices00 = dwv.math.getEllipseIndices(center00, radius00, dir00);
  // sort
  indices00.sort();
  // filter duplicates
  indices00 = indices00.filter(function (item, index, arr) {
    return !item.equals(arr[index - 1]);
  });

  assert.ok(indices00.length, theoRes.length,
    'index list and theo result have same size');
  var isEqual = true;
  for (var k = 0; k < indices00.length; ++k) {
    if (!indices00[k].equals(theoRes[k])) {
      isEqual = false;
      break;
    }
  }
  assert.ok(isEqual,
    'index list and theo result have same values');
});
