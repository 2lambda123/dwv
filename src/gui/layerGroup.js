import {getIdentityMat33, getCoronalMat33} from '../math/matrix';
import {Index} from '../math/index';
import {Point} from '../math/point';
import {Vector3D} from '../math/vector';
import {ViewEventNames} from '../image/view';
import {ListenerHandler} from '../utils/listen';
import {logger} from '../utils/logger';
import {ViewLayer} from './viewLayer';
import {DrawLayer} from './drawLayer';

/**
 * Get the layer div id.
 *
 * @param {string} groupDivId The layer group div id.
 * @param {number} layerId The lyaer id.
 * @returns {string} A string id.
 */
export function getLayerDivId(groupDivId, layerId) {
  return groupDivId + '-layer-' + layerId;
}

/**
 * Get the layer details from a div id.
 *
 * @param {string} idString The layer div id.
 * @returns {object} The layer details as {groupDivId, layerId}.
 */
export function getLayerDetailsFromLayerDivId(idString) {
  var split = idString.split('-layer-');
  if (split.length !== 2) {
    logger.warn('Not the expected layer div id format...');
  }
  return {
    groupDivId: split[0],
    layerId: split[1]
  };
}

/**
 * Get the layer details from a mouse event.
 *
 * @param {object} event The event to get the layer div id from. Expecting
 * an event origininating from a canvas inside a layer HTML div
 * with the 'layer' class and id generated with `getLayerDivId`.
 * @returns {object} The layer details as {groupDivId, layerId}.
 */
export function getLayerDetailsFromEvent(event) {
  var res = null;
  // get the closest element from the event target and with the 'layer' class
  var layerDiv = event.target.closest('.layer');
  if (layerDiv && typeof layerDiv.id !== 'undefined') {
    res = getLayerDetailsFromLayerDivId(layerDiv.id);
  }
  return res;
}

/**
 * Get the view orientation according to an image and target orientation.
 * The view orientation is used to go from target to image space.
 *
 * @param {Matrix33} imageOrientation The image geometry.
 * @param {Matrix33} targetOrientation The target orientation.
 * @returns {Matrix33} The view orientation.
 */
export function getViewOrientation(imageOrientation, targetOrientation) {
  var viewOrientation = getIdentityMat33();
  if (typeof targetOrientation !== 'undefined') {
    // i: image, v: view, t: target, O: orientation, P: point
    // [Img] -- Oi --> [Real] <-- Ot -- [Target]
    // Pi = (Oi)-1 * Ot * Pt = Ov * Pt
    // -> Ov = (Oi)-1 * Ot
    // TODO: asOneAndZeros simplifies but not nice...
    viewOrientation =
      imageOrientation.asOneAndZeros().getInverse().multiply(targetOrientation);
  }
  // TODO: why abs???
  return viewOrientation.getAbs();
}

/**
 * Get the target orientation according to an image and view orientation.
 * The target orientation is used to go from target to real space.
 *
 * @param {Matrix33} imageOrientation The image geometry.
 * @param {Matrix33} viewOrientation The view orientation.
 * @returns {Matrix33} The target orientation.
 */
export function getTargetOrientation(imageOrientation, viewOrientation) {
  // i: image, v: view, t: target, O: orientation, P: point
  // [Img] -- Oi --> [Real] <-- Ot -- [Target]
  // Pi = (Oi)-1 * Ot * Pt = Ov * Pt
  // -> Ot = Oi * Ov
  // note: asOneAndZeros as in getViewOrientation...
  var targetOrientation =
    imageOrientation.asOneAndZeros().multiply(viewOrientation);

  // TODO: why abs???
  var simpleImageOrientation = imageOrientation.asOneAndZeros().getAbs();
  if (simpleImageOrientation.equals(getCoronalMat33().getAbs())) {
    targetOrientation = targetOrientation.getAbs();
  }

  return targetOrientation;
}

/**
 * Get a scaled offset to adapt to new scale and such as the input center
 * stays at the same position.
 *
 * @param {object} offset The previous offset as {x,y}.
 * @param {object} scale The previous scale as {x,y}.
 * @param {object} newScale The new scale as {x,y}.
 * @param {object} center The scale center as {x,y}.
 * @returns {object} The scaled offset as {x,y}.
 */
export function getScaledOffset(offset, scale, newScale, center) {
  // worldPoint = indexPoint / scale + offset
  //=> indexPoint = (worldPoint - offset ) * scale

  // plane center should stay the same:
  // indexCenter / newScale + newOffset =
  //   indexCenter / oldScale + oldOffset
  //=> newOffset = indexCenter / oldScale + oldOffset -
  //     indexCenter / newScale
  //=> newOffset = worldCenter - indexCenter / newScale
  var indexCenter = {
    x: (center.x - offset.x) * scale.x,
    y: (center.y - offset.y) * scale.y
  };
  return {
    x: center.x - (indexCenter.x / newScale.x),
    y: center.y - (indexCenter.y / newScale.y)
  };
}

/**
 * Layer group.
 *
 * Display position: {x,y}
 * Plane position: Index (access: get(i))
 * (world) Position: Point3D (access: getX, getY, getZ)
 *
 * Display -> World:
 * planePos = viewLayer.displayToPlanePos(displayPos)
 * -> compensate for layer scale and offset
 * pos = viewController.getPositionFromPlanePoint(planePos)
 *
 * World -> display
 * planePos = viewController.getOffset3DFromPlaneOffset(pos)
 * no need yet for a planePos to displayPos...
 *
 * @param {object} containerDiv The associated HTML div.
 * @class
 */
export class LayerGroup {

  #containerDiv;

  constructor(containerDiv) {
    this.#containerDiv = containerDiv;
  }

  // list of layers
  #layers = [];

  /**
   * The layer scale as {x,y}.
   *
   * @private
   * @type {object}
   */
  #scale = {x: 1, y: 1, z: 1};

  /**
   * The base scale as {x,y}: all posterior scale will be on top of this one.
   *
   * @private
   * @type {object}
   */
  #baseScale = {x: 1, y: 1, z: 1};

  /**
   * The layer offset as {x,y}.
   *
   * @private
   * @type {object}
   */
  #offset = {x: 0, y: 0, z: 0};

  /**
   * Active view layer index.
   *
   * @private
   * @type {number}
   */
  #activeViewLayerIndex = null;

  /**
   * Active draw layer index.
   *
   * @private
   * @type {number}
   */
  #activeDrawLayerIndex = null;

  /**
   * Listener handler.
   *
   * @type {object}
   * @private
   */
  #listenerHandler = new ListenerHandler();

  /**
   * The target orientation matrix.
   *
   * @type {object}
   * @private
   */
  #targetOrientation;

  /**
   * Flag to activate crosshair or not.
   *
   * @type {boolean}
   * @private
   */
  #showCrosshair = false;

  /**
   * The current position used for the crosshair.
   *
   * @type {Point}
   * @private
   */
  #currentPosition;

  /**
   * Get the target orientation.
   *
   * @returns {Matrix33} The orientation matrix.
   */
  getTargetOrientation() {
    return this.#targetOrientation;
  }

  /**
   * Set the target orientation.
   *
   * @param {Matrix33} orientation The orientation matrix.
   */
  setTargetOrientation(orientation) {
    this.#targetOrientation = orientation;
  }

  /**
   * Get the showCrosshair flag.
   *
   * @returns {boolean} True to display the crosshair.
   */
  getShowCrosshair() {
    return this.#showCrosshair;
  }

  /**
   * Set the showCrosshair flag.
   *
   * @param {boolean} flag True to display the crosshair.
   */
  setShowCrosshair(flag) {
    this.#showCrosshair = flag;
    if (flag) {
      // listen to offset and zoom change
      this.addEventListener('offsetchange', this.#updateCrosshairOnChange);
      this.addEventListener('zoomchange', this.#updateCrosshairOnChange);
      // show crosshair div
      this.#showCrosshairDiv();
    } else {
      // listen to offset and zoom change
      this.removeEventListener('offsetchange', this.#updateCrosshairOnChange);
      this.removeEventListener('zoomchange', this.#updateCrosshairOnChange);
      // remove crosshair div
      this.#removeCrosshairDiv();
    }
  }

  /**
   * Update crosshair on offset or zoom change.
   *
   * @param {object} _event The change event.
   */
  #updateCrosshairOnChange = (_event) => {
    this.#showCrosshairDiv();
  };

  /**
   * Get the Id of the container div.
   *
   * @returns {string} The id of the div.
   */
  getDivId() {
    return this.#containerDiv.id;
  }

  /**
   * Get the layer scale.
   *
   * @returns {object} The scale as {x,y,z}.
   */
  getScale() {
    return this.#scale;
  }

  /**
   * Get the base scale.
   *
   * @returns {object} The scale as {x,y,z}.
   */
  getBaseScale() {
    return this.#baseScale;
  }

  /**
   * Get the added scale: the scale added to the base scale
   *
   * @returns {object} The scale as {x,y,z}.
   */
  getAddedScale() {
    return {
      x: this.#scale.x / this.#baseScale.x,
      y: this.#scale.y / this.#baseScale.y,
      z: this.#scale.z / this.#baseScale.z
    };
  }

  /**
   * Get the layer offset.
   *
   * @returns {object} The offset as {x,y,z}.
   */
  getOffset() {
    return this.#offset;
  }

  /**
   * Get the number of layers handled by this class.
   *
   * @returns {number} The number of layers.
   */
  getNumberOfLayers() {
    return this.#layers.length;
  }

  /**
   * Get the active image layer.
   *
   * @returns {object} The layer.
   */
  getActiveViewLayer() {
    return this.#layers[this.#activeViewLayerIndex];
  }

  /**
   * Get the view layers associated to a data index.
   *
   * @param {number} index The data index.
   * @returns {Array} The layers.
   */
  getViewLayersByDataIndex(index) {
    var res = [];
    for (var i = 0; i < this.#layers.length; ++i) {
      if (this.#layers[i] instanceof ViewLayer &&
        this.#layers[i].getDataIndex() === index) {
        res.push(this.#layers[i]);
      }
    }
    return res;
  }

  /**
   * Search view layers for equal imae meta data.
   *
   * @param {object} meta The meta data to find.
   * @returns {Array} The list of view layers that contain matched data.
   */
  searchViewLayers(meta) {
    var res = [];
    for (var i = 0; i < this.#layers.length; ++i) {
      if (this.#layers[i] instanceof ViewLayer) {
        if (this.#layers[i].getViewController().equalImageMeta(meta)) {
          res.push(this.#layers[i]);
        }
      }
    }
    return res;
  }

  /**
   * Get the view layers data indices.
   *
   * @returns {Array} The list of indices.
   */
  getViewDataIndices() {
    var res = [];
    for (var i = 0; i < this.#layers.length; ++i) {
      if (this.#layers[i] instanceof ViewLayer) {
        res.push(this.#layers[i].getDataIndex());
      }
    }
    return res;
  }

  /**
   * Get the active draw layer.
   *
   * @returns {object} The layer.
   */
  getActiveDrawLayer() {
    return this.#layers[this.#activeDrawLayerIndex];
  }

  /**
   * Get the draw layers associated to a data index.
   *
   * @param {number} index The data index.
   * @returns {Array} The layers.
   */
  getDrawLayersByDataIndex(index) {
    var res = [];
    for (var i = 0; i < this.#layers.length; ++i) {
      if (this.#layers[i] instanceof DrawLayer &&
        this.#layers[i].getDataIndex() === index) {
        res.push(this.#layers[i]);
      }
    }
    return res;
  }

  /**
   * Set the active view layer.
   *
   * @param {number} index The index of the layer to set as active.
   */
  setActiveViewLayer(index) {
    this.#activeViewLayerIndex = index;
  }

  /**
   * Set the active view layer with a data index.
   *
   * @param {number} index The data index.
   */
  setActiveViewLayerByDataIndex(index) {
    for (var i = 0; i < this.#layers.length; ++i) {
      if (this.#layers[i] instanceof ViewLayer &&
        this.#layers[i].getDataIndex() === index) {
        this.setActiveViewLayer(i);
        break;
      }
    }
  }

  /**
   * Set the active draw layer.
   *
   * @param {number} index The index of the layer to set as active.
   */
  setActiveDrawLayer(index) {
    this.#activeDrawLayerIndex = index;
  }

  /**
   * Set the active draw layer with a data index.
   *
   * @param {number} index The data index.
   */
  setActiveDrawLayerByDataIndex(index) {
    for (var i = 0; i < this.#layers.length; ++i) {
      if (this.#layers[i] instanceof DrawLayer &&
        this.#layers[i].getDataIndex() === index) {
        this.setActiveDrawLayer(i);
        break;
      }
    }
  }

  /**
   * Add a view layer.
   *
   * @returns {object} The created layer.
   */
  addViewLayer() {
    // layer index
    var viewLayerIndex = this.#layers.length;
    // create div
    var div = this.#getNextLayerDiv();
    // prepend to container
    this.#containerDiv.append(div);
    // view layer
    var layer = new ViewLayer(div);
    // add layer
    this.#layers.push(layer);
    // mark it as active
    this.setActiveViewLayer(viewLayerIndex);
    // bind view layer events
    this.#bindViewLayer(layer);
    // return
    return layer;
  }

  /**
   * Add a draw layer.
   *
   * @returns {object} The created layer.
   */
  addDrawLayer() {
    // store active index
    this.#activeDrawLayerIndex = this.#layers.length;
    // create div
    var div = this.#getNextLayerDiv();
    // prepend to container
    this.#containerDiv.append(div);
    // draw layer
    var layer = new DrawLayer(div);
    // add layer
    this.#layers.push(layer);
    // bind draw layer events
    this.#bindDrawLayer(layer);
    // return
    return layer;
  }

  /**
   * Bind view layer events to this.
   *
   * @param {object} viewLayer The view layer to bind.
   */
  #bindViewLayer(viewLayer) {
    // listen to position change to update other group layers
    viewLayer.addEventListener(
      'positionchange', this.updateLayersToPositionChange);
    // propagate view viewLayer-layer events
    for (var j = 0; j < ViewEventNames.length; ++j) {
      viewLayer.addEventListener(ViewEventNames[j], this.#fireEvent);
    }
    // propagate viewLayer events
    viewLayer.addEventListener('renderstart', this.#fireEvent);
    viewLayer.addEventListener('renderend', this.#fireEvent);
  }

  /**
   * Bind draw layer events to this.
   *
   * @param {object} drawLayer The draw layer to bind.
   */
  #bindDrawLayer(drawLayer) {
    // propagate drawLayer events
    drawLayer.addEventListener('drawcreate', this.#fireEvent);
    drawLayer.addEventListener('drawdelete', this.#fireEvent);
  }

  /**
   * Get the next layer DOM div.
   *
   * @returns {HTMLElement} A DOM div.
   */
  #getNextLayerDiv() {
    var div = document.createElement('div');
    div.id = getLayerDivId(this.getDivId(), this.#layers.length);
    div.className = 'layer';
    div.style.pointerEvents = 'none';
    return div;
  }

  /**
   * Empty the layer list.
   */
  empty() {
    this.#layers = [];
    // reset active indices
    this.#activeViewLayerIndex = null;
    this.#activeDrawLayerIndex = null;
    // clean container div
    var previous = this.#containerDiv.getElementsByClassName('layer');
    if (previous) {
      while (previous.length > 0) {
        previous[0].remove();
      }
    }
  }

  /**
   * Show a crosshair at a given position.
   *
   * @param {Point} position The position where to show the crosshair.
   */
  #showCrosshairDiv(position) {
    if (typeof position === 'undefined') {
      position = this.#currentPosition;
    }

    // remove previous
    this.#removeCrosshairDiv();

    // use first layer as base for calculating position and
    // line sizes
    var layer0 = this.#layers[0];
    var vc = layer0.getViewController();
    var p2D = vc.getPlanePositionFromPosition(position);
    var displayPos = layer0.planePosToDisplay(p2D.x, p2D.y);

    var lineH = document.createElement('hr');
    lineH.id = this.getDivId() + '-scroll-crosshair-horizontal';
    lineH.className = 'horizontal';
    lineH.style.width = this.#containerDiv.offsetWidth + 'px';
    lineH.style.left = '0px';
    lineH.style.top = displayPos.y + 'px';

    var lineV = document.createElement('hr');
    lineV.id = this.getDivId() + '-scroll-crosshair-vertical';
    lineV.className = 'vertical';
    lineV.style.width = this.#containerDiv.offsetHeight + 'px';
    lineV.style.left = (displayPos.x) + 'px';
    lineV.style.top = '0px';

    this.#containerDiv.appendChild(lineH);
    this.#containerDiv.appendChild(lineV);
  }

  /**
   * Remove crosshair divs.
   */
  #removeCrosshairDiv() {
    var div = document.getElementById(
      this.getDivId() + '-scroll-crosshair-horizontal');
    if (div) {
      div.remove();
    }
    div = document.getElementById(
      this.getDivId() + '-scroll-crosshair-vertical');
    if (div) {
      div.remove();
    }
  }

  /**
   * Update layers (but not the active view layer) to a position change.
   *
   * @param {object} event The position change event.
   */
  updateLayersToPositionChange = (event) => {
    // pause positionchange listeners
    for (var j = 0; j < this.#layers.length; ++j) {
      if (this.#layers[j] instanceof ViewLayer) {
        this.#layers[j].removeEventListener(
          'positionchange', this.updateLayersToPositionChange);
        this.#layers[j].removeEventListener('positionchange', this.#fireEvent);
      }
    }

    var index = new Index(event.value[0]);
    var position = new Point(event.value[1]);

    // store current position
    this.#currentPosition = position;

    if (this.#showCrosshair) {
      this.#showCrosshairDiv(position);
    }

    // origin of the first view layer
    var baseViewLayerOrigin0 = null;
    var baseViewLayerOrigin = null;
    // update position for all layers except the source one
    for (var i = 0; i < this.#layers.length; ++i) {

      // update base offset (does not trigger redraw)
      // TODO check draw layers update
      var hasSetOffset = false;
      if (this.#layers[i] instanceof ViewLayer) {
        var vc = this.#layers[i].getViewController();
        // origin0 should always be there
        var origin0 = vc.getOrigin();
        // depending on position, origin could be undefined
        var origin = vc.getOrigin(position);

        if (!baseViewLayerOrigin) {
          baseViewLayerOrigin0 = origin0;
          baseViewLayerOrigin = origin;
        } else {
          if (vc.canSetPosition(position) &&
            typeof origin !== 'undefined') {
            // TODO: compensate for possible different orientation between views

            var scrollDiff = baseViewLayerOrigin0.minus(origin0);
            var scrollOffset = new Vector3D(
              scrollDiff.getX(), scrollDiff.getY(), scrollDiff.getZ());

            var planeDiff = baseViewLayerOrigin.minus(origin);
            var planeOffset = new Vector3D(
              planeDiff.getX(), planeDiff.getY(), planeDiff.getZ());

            hasSetOffset =
              this.#layers[i].setBaseOffset(scrollOffset, planeOffset);
          }
        }
      }

      // update position (triggers redraw)
      var hasSetPos = false;
      if (this.#layers[i].getId() !== event.srclayerid) {
        hasSetPos = this.#layers[i].setCurrentPosition(position, index);
      }

      // force redraw if needed
      if (!hasSetPos && hasSetOffset) {
        this.#layers[i].draw();
      }
    }

    // re-start positionchange listeners
    for (var k = 0; k < this.#layers.length; ++k) {
      if (this.#layers[k] instanceof ViewLayer) {
        this.#layers[k].addEventListener(
          'positionchange', this.updateLayersToPositionChange);
        this.#layers[k].addEventListener('positionchange', this.#fireEvent);
      }
    }
  };

  /**
   * Calculate the fit scale: the scale that fits the largest data.
   *
   * @returns {number|undefined} The fit scale.
   */
  calculateFitScale() {
    // check container
    if (this.#containerDiv.offsetWidth === 0 &&
      this.#containerDiv.offsetHeight === 0) {
      throw new Error('Cannot fit to zero sized container.');
    }
    // get max size
    var maxSize = this.getMaxSize();
    if (typeof maxSize === 'undefined') {
      return undefined;
    }
    // return best fit
    return Math.min(
      this.#containerDiv.offsetWidth / maxSize.x,
      this.#containerDiv.offsetHeight / maxSize.y
    );
  }

  /**
   * Set the layer group fit scale.
   *
   * @param {number} scaleIn The fit scale.
   */
  setFitScale(scaleIn) {
    // get maximum size
    var maxSize = this.getMaxSize();
    // exit if none
    if (typeof maxSize === 'undefined') {
      return;
    }

    var containerSize = {
      x: this.#containerDiv.offsetWidth,
      y: this.#containerDiv.offsetHeight
    };
    // offset to keep data centered
    var fitOffset = {
      x: -0.5 * (containerSize.x - Math.floor(maxSize.x * scaleIn)),
      y: -0.5 * (containerSize.y - Math.floor(maxSize.y * scaleIn))
    };

    // apply to layers
    for (var j = 0; j < this.#layers.length; ++j) {
      this.#layers[j].fitToContainer(scaleIn, containerSize, fitOffset);
    }

    // update crosshair
    if (this.#showCrosshair) {
      this.#showCrosshairDiv();
    }
  }

  /**
   * Get the largest data size.
   *
   * @returns {object|undefined} The largest size as {x,y}.
   */
  getMaxSize() {
    var maxSize = {x: 0, y: 0};
    for (var j = 0; j < this.#layers.length; ++j) {
      if (this.#layers[j] instanceof ViewLayer) {
        var size = this.#layers[j].getImageWorldSize();
        if (size.x > maxSize.x) {
          maxSize.x = size.x;
        }
        if (size.y > maxSize.y) {
          maxSize.y = size.y;
        }
      }
    }
    if (maxSize.x === 0 && maxSize.y === 0) {
      maxSize = undefined;
    }
    return maxSize;
  }

  /**
   * Flip all layers along the Z axis without offset compensation.
   */
  flipScaleZ() {
    this.#baseScale.z *= -1;
    this.setScale(this.#baseScale);
  }

  /**
   * Add scale to the layers. Scale cannot go lower than 0.1.
   *
   * @param {number} scaleStep The scale to add.
   * @param {Point3D} center The scale center Point3D.
   */
  addScale(scaleStep, center) {
    var newScale = {
      x: this.#scale.x * (1 + scaleStep),
      y: this.#scale.y * (1 + scaleStep),
      z: this.#scale.z * (1 + scaleStep)
    };
    this.setScale(newScale, center);
  }

  /**
   * Set the layers' scale.
   *
   * @param {object} newScale The scale to apply as {x,y,z}.
   * @param {Point3D} center The scale center Point3D.
   * @fires LayerGroup#zoomchange
   */
  setScale(newScale, center) {
    this.#scale = newScale;
    // apply to layers
    for (var i = 0; i < this.#layers.length; ++i) {
      this.#layers[i].setScale(this.#scale, center);
    }

    // event value
    var value = [
      newScale.x,
      newScale.y,
      newScale.z
    ];
    if (typeof center !== 'undefined') {
      value.push(center.getX());
      value.push(center.getY());
      value.push(center.getZ());
    }

    /**
     * Zoom change event.
     *
     * @event LayerGroup#zoomchange
     * @type {object}
     * @property {Array} value The changed value.
     */
    this.#fireEvent({
      type: 'zoomchange',
      value: value
    });
  }

  /**
   * Add translation to the layers.
   *
   * @param {object} translation The translation as {x,y,z}.
   */
  addTranslation(translation) {
    this.setOffset({
      x: this.#offset.x - translation.x,
      y: this.#offset.y - translation.y,
      z: this.#offset.z - translation.z
    });
  }

  /**
   * Set the layers' offset.
   *
   * @param {object} newOffset The offset as {x,y,z}.
   * @fires LayerGroup#offsetchange
   */
  setOffset(newOffset) {
    // store
    this.#offset = newOffset;
    // apply to layers
    for (var i = 0; i < this.#layers.length; ++i) {
      this.#layers[i].setOffset(this.#offset);
    }

    /**
     * Offset change event.
     *
     * @event LayerGroup#offsetchange
     * @type {object}
     * @property {Array} value The changed value.
     */
    this.#fireEvent({
      type: 'offsetchange',
      value: [
        this.#offset.x,
        this.#offset.y,
        this.#offset.z
      ]
    });
  }

  /**
   * Reset the stage to its initial scale and no offset.
   */
  reset() {
    this.setScale(this.#baseScale);
    this.setOffset({x: 0, y: 0, z: 0});
  }

  /**
   * Draw the layer.
   */
  draw() {
    for (var i = 0; i < this.#layers.length; ++i) {
      this.#layers[i].draw();
    }
  }

  /**
   * Display the layer.
   *
   * @param {boolean} flag Whether to display the layer or not.
   */
  display(flag) {
    for (var i = 0; i < this.#layers.length; ++i) {
      this.#layers[i].display(flag);
    }
  }

  /**
   * Add an event listener to this class.
   *
   * @param {string} type The event type.
   * @param {object} callback The method associated with the provided
   *   event type, will be called with the fired event.
   */
  addEventListener(type, callback) {
    this.#listenerHandler.add(type, callback);
  }

  /**
   * Remove an event listener from this class.
   *
   * @param {string} type The event type.
   * @param {object} callback The method associated with the provided
   *   event type.
   */
  removeEventListener(type, callback) {
    this.#listenerHandler.remove(type, callback);
  }

  /**
   * Fire an event: call all associated listeners with the input event object.
   *
   * @param {object} event The event to fire.
   * @private
   */
  #fireEvent = (event) => {
    this.#listenerHandler.fireEvent(event);
  };

} // LayerGroup class
