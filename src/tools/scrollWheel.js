// namespaces
var dwv = dwv || {};
dwv.tool = dwv.tool || {};

/**
 * Scroll wheel class: provides a wheel event handler
 *   that scroll the corresponding data.
 *
 * @class
 * @param {dwv.App} app The associated application.
 */
dwv.tool.ScrollWheel = function (app) {
  /**
   * Accumulated wheel event deltaY.
   *
   * @type {number}
   */
  var wheelDeltaY = 0;

  /**
   * Handle mouse wheel event.
   *
   * @param {object} event The mouse wheel event.
   */
  this.wheel = function (event) {
    // deltaMode (deltaY values on my machine...):
    // - 0 (DOM_DELTA_PIXEL): chrome, deltaY mouse scroll = 53
    // - 1 (DOM_DELTA_LINE): firefox, deltaY mouse scroll = 6
    // - 2 (DOM_DELTA_PAGE): ??
    // TODO: check scroll event
    var scrollMin = 52;
    if (event.deltaMode === 1) {
      scrollMin = 5.99;
    }
    wheelDeltaY += event.deltaY;
    if (Math.abs(wheelDeltaY) < scrollMin) {
      return;
    } else {
      wheelDeltaY = 0;
    }

    var up = event.deltaY < 0 ? true : false;

    var layerDetails = dwv.gui.getLayerDetailsFromEvent(event);
    var layerGroup = app.getLayerGroupByDivId(layerDetails.groupDivId);
    var viewController =
      layerGroup.getActiveViewLayer().getViewController();
    var imageSize = viewController.getImageSize();
    if (imageSize.canScroll3D()) {
      if (up) {
        viewController.incrementScrollIndex();
      } else {
        viewController.decrementScrollIndex();
      }
    } else if (imageSize.moreThanOne(3)) {
      if (up) {
        viewController.incrementIndex(3);
      } else {
        viewController.decrementIndex(3);
      }
    }
  };
}; // ScrollWheel class
