// namespaces
var dwv = dwv || {};

/**
 * View controller.
 *
 * @param {dwv.image.View} view The associated view.
 * @class
 */
dwv.ViewController = function (view) {
  // closure to self
  var self = this;
  // Slice/frame player ID (created by setInterval)
  var playerID = null;

  /**
   * Initialise the controller.
   */
  this.initialise = function () {
    // set window/level to first preset
    this.setWindowLevelPresetById(0);
    // default position
    this.setCurrentPosition2D(0, 0);
    // default frame
    this.setCurrentFrame(0);
  };

  /**
   * Get the window/level presets names.
   *
   * @returns {Array} The presets names.
   */
  this.getWindowLevelPresetsNames = function () {
    return view.getWindowPresetsNames();
  };

  /**
   * Add window/level presets to the view.
   *
   * @param {object} presets A preset object.
   * @returns {object} The list of presets.
   */
  this.addWindowLevelPresets = function (presets) {
    return view.addWindowPresets(presets);
  };

  /**
   * Set the window level to the preset with the input name.
   *
   * @param {string} name The name of the preset to activate.
   */
  this.setWindowLevelPreset = function (name) {
    view.setWindowLevelPreset(name);
  };

  /**
   * Set the window level to the preset with the input id.
   *
   * @param {number} id The id of the preset to activate.
   */
  this.setWindowLevelPresetById = function (id) {
    view.setWindowLevelPresetById(id);
  };

  /**
   * Check if the controller is playing.
   *
   * @returns {boolean} True is the controler is playing slices/frames.
   */
  this.isPlaying = function () {
    return (playerID !== null);
  };

  /**
   * Get the current position.
   *
   * @returns {object} The position.
   */
  this.getCurrentPosition = function () {
    return view.getCurrentPosition();
  };

  /**
   * Get the current spacing.
   *
   * @returns {Array} The 2D spacing.
   */
  this.get2DSpacing = function () {
    var spacing = view.getImage().getGeometry().getSpacing();
    return [spacing.getColumnSpacing(), spacing.getRowSpacing()];
  };

  /**
   * Get some values from the associated image in a region.
   *
   * @param {dwv.math.Point2D} min Minimum point.
   * @param {dwv.math.Point2D} max Maximum point.
   * @returns {Array} A list of values.
   */
  this.getImageRegionValues = function (min, max) {
    var iter = view.getRegionSliceIterator(
      this.getCurrentPosition().k,
      this.getCurrentFrame(),
      true, min, max
    );
    var values = [];
    if (iter) {
      values = view.getImage().getValues(iter);
    }
    return values;
  };

  /**
   * Get some values from the associated image in variable regions.
   *
   * @param {Array} regions A list of regions.
   * @returns {Array} A list of values.
   */
  this.getImageVariableRegionValues = function (regions) {
    var iter = view.getVariableRegionSliceIterator(
      this.getCurrentPosition().k,
      this.getCurrentFrame(),
      true, regions
    );
    var values = [];
    if (iter) {
      values = view.getImage().getValues(iter);
    }
    return values;
  };

  /**
   * Can the image values be quantified?
   *
   * @returns {boolean} True if possible.
   */
  this.canQuantifyImage = function () {
    return view.getImage().getNumberOfComponents() === 1;
  };

  /**
   * Can window and level be applied to the data?
   *
   * @returns {boolean} True if the data is monochrome.
   */
  this.canWindowLevel = function () {
    return view.getImage().getPhotometricInterpretation()
      .match(/MONOCHROME/) !== null;
  };

  /**
   * Is the data mono-frame?
   *
   * @returns {boolean} True if the data only contains one frame.
   */
  this.isMonoFrameData = function () {
    return view.getImage().getNumberOfFrames() === 1;
  };

  /**
   * Set the current position.
   *
   * @param {object} pos The position.
   * @returns {boolean} False if not in bounds.
   */
  this.setCurrentPosition = function (pos) {
    return view.setCurrentPosition(pos);
  };

  /**
   * Set the current 2D (i,j) position.
   *
   * @param {number} i The column index.
   * @param {number} j The row index.
   * @returns {boolean} False if not in bounds.
   */
  this.setCurrentPosition2D = function (i, j) {
    return view.setCurrentPosition({
      i: i,
      j: j,
      k: view.getCurrentPosition().k
    });
  };

  /**
   * Set the current slice position.
   *
   * @param {number} k The slice index.
   * @returns {boolean} False if not in bounds.
   */
  this.setCurrentSlice = function (k) {
    return view.setCurrentPosition({
      i: view.getCurrentPosition().i,
      j: view.getCurrentPosition().j,
      k: k
    });
  };

  /**
   * Increment the current slice number.
   *
   * @returns {boolean} False if not in bounds.
   */
  this.incrementSliceNb = function () {
    return self.setCurrentSlice(view.getCurrentPosition().k + 1);
  };

  /**
   * Decrement the current slice number.
   *
   * @returns {boolean} False if not in bounds.
   */
  this.decrementSliceNb = function () {
    return self.setCurrentSlice(view.getCurrentPosition().k - 1);
  };

  /**
   * Get the current frame.
   *
   * @returns {number} The frame number.
   */
  this.getCurrentFrame = function () {
    return view.getCurrentFrame();
  };

  /**
   * Set the current frame.
   *
   * @param {number} number The frame number.
   * @returns {boolean} False if not in bounds.
   */
  this.setCurrentFrame = function (number) {
    return view.setCurrentFrame(number);
  };

  /**
   * Increment the current frame.
   *
   * @returns {boolean} False if not in bounds.
   */
  this.incrementFrameNb = function () {
    return view.setCurrentFrame(view.getCurrentFrame() + 1);
  };

  /**
   * Decrement the current frame.
   *
   * @returns {boolean} False if not in bounds.
   */
  this.decrementFrameNb = function () {
    return view.setCurrentFrame(view.getCurrentFrame() - 1);
  };

  /**
   * Go to first slice .
   *
   * @returns {boolean} False if not in bounds.
   * @deprecated Use the setCurrentSlice function.
   */
  this.goFirstSlice = function () {
    return view.setCurrentPosition({
      i: view.getCurrentPosition().i,
      j: view.getCurrentPosition().j,
      k: 0
    });
  };

  /**
   *
   */
  this.play = function () {
    if (playerID === null) {
      var nSlices = view.getImage().getGeometry().getSize().getNumberOfSlices();
      var nFrames = view.getImage().getNumberOfFrames();
      var recommendedDisplayFrameRate =
        view.getImage().getMeta().RecommendedDisplayFrameRate;
      var milliseconds = view.getPlaybackMilliseconds(
        recommendedDisplayFrameRate);

      playerID = setInterval(function () {
        if (nSlices !== 1) {
          if (!self.incrementSliceNb()) {
            self.setCurrentSlice(0);
          }
        } else if (nFrames !== 1) {
          if (!self.incrementFrameNb()) {
            self.setCurrentFrame(0);
          }
        }

      }, milliseconds);
    } else {
      this.stop();
    }
  };

  /**
   *
   */
  this.stop = function () {
    if (playerID !== null) {
      clearInterval(playerID);
      playerID = null;
    }
  };

  /**
   * Get the window/level.
   *
   * @returns {object} The window center and width.
   */
  this.getWindowLevel = function () {
    return {
      width: view.getCurrentWindowLut().getWindowLevel().getWidth(),
      center: view.getCurrentWindowLut().getWindowLevel().getCenter()
    };
  };

  /**
   * Set the window/level.
   *
   * @param {number} wc The window center.
   * @param {number} ww The window width.
   */
  this.setWindowLevel = function (wc, ww) {
    view.setWindowLevel(wc, ww);
  };

  /**
   * Get the colour map.
   *
   * @returns {object} The colour map.
   */
  this.getColourMap = function () {
    return view.getColourMap();
  };

  /**
   * Set the colour map.
   *
   * @param {object} colourMap The colour map.
   */
  this.setColourMap = function (colourMap) {
    view.setColourMap(colourMap);
  };

  /**
   * Set the colour map from a name.
   *
   * @param {string} name The name of the colour map to set.
   */
  this.setColourMapFromName = function (name) {
    // check if we have it
    if (!dwv.tool.colourMaps[name]) {
      throw new Error('Unknown colour map: \'' + name + '\'');
    }
    // enable it
    this.setColourMap(dwv.tool.colourMaps[name]);
  };

}; // class dwv.ViewController
