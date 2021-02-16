  /*
tetrisgame is overall game controller.

shapegenerator issues "shape-generated" event.
tetris binds to that new object. listening for "landed" event.
when "landed" event occurs, tetris invokes the shape generator again...

*/
var CONTINUOUS = true;
var GRID_UNIT = 0.1;

const cloneArray = (items) => items.map(item => Array.isArray(item) ? cloneArray(item) : item);

// Overall game controller.
AFRAME.registerComponent('tetrisgame', {
  schema: {
    generator: {type: 'string', default: '#shapegenerator'},
    arena: {type: 'string', default: '#arena'},
    scoreboard: {type: 'string', default: "#scoreboard"},
    debug:          {type: 'boolean', default: false},
    logger:        {type: 'string', default: "#log-panel1"},
    focus:         {type: 'boolean', default: true},
    levelduration: {type: 'number', default: 60},
    levelspeedup: {type: 'number', default: 10},
    initialspeed: {type: 'number', default: 1000}
  },

  // This caused problems (leads to shapegenerator init/update being calles with default values)
  // Don't reallyunderstand why, but trying to remove it.
  //dependencies: ['shapegenerator'],
  // Set up main game logic with attachment to specified shape generator.
  // Note, we won't handle updates to the shape generator.
  init: function () {

    // Find and initialize the scoreboard.
    this.scoreboard = document.querySelector(this.data.scoreboard);
    this.score = 0;
    this.scoreboard.setAttribute("text", "value: Score:" + this.score);
    this.lastScoreboardTime = 0;
    this.gameOver = true; // before game has started, we consider "game over".
    this.gameStartTime = 0;
    this.gameTimeSecs = 0;
    this.level = 0;
    this.changedLevelTime = 0;
    this.levelDurationMsecs = this.data.levelduration * 1000;
    this.levelSpeedMultiplier = (100 - this.data.levelspeedup)/100;
    this.blockFallSpeed = this.data.initialspeed;

    this.focus = this.data.focus;

    this.currentShape = null;
    this.listeners = {
      'startGame': this.startGame.bind(this),
      'shapeCreated': this.shapeCreated.bind(this),
      'shapeLanded': this.shapeLanded.bind(this),
      'layersRemoved': this.onLayersRemoved.bind(this),
      'arenaFull': this.onArenaFull.bind(this),
      'focus': this.onFocus.bind(this),
      'defocus': this.onDefocus.bind(this)
    }

    // Listen for focus events on ourself.
    this.el.addEventListener("focus", this.listeners.focus);
    this.el.addEventListener("defocus", this.listeners.defocus);

    // Find and store the arena, and register for events that affect the score.
    this.arena = document.querySelector(this.data.arena);
    this.arena.addEventListener("layers-removed",
                                this.listeners.layersRemoved);
    this.arena.addEventListener("arena-full",
                                this.listeners.arenaFull);

    // ALso get some references to the shape generator.
    this.generator = document.querySelector(this.data.generator);
    this._generator = this.generator.components.shapegenerator;

    console.log(`Generator: ${this.data.generator}`);
    console.log(`Resolved to: ${this.generator}`);
    console.log(`With internal component: ${this._generator}`);

    if (!this.generator) {
      console.log("Error - couldn't attach to shape generator")
    }

    this.generator.addEventListener("new-shape", this.listeners.shapeCreated);

    // Finally, we need to register for the "start" event on this object.
    // That comes from outside this component, depending on the desired "start"
    // mechanic.  See README and Examples for how this can be done.
    this.el.addEventListener("start", this.listeners.startGame);
  },

  shapeCreated: function(event) {

    // New shape generated.  Attach to it and track for landing.
    var shapeId = event.detail.shapeId;
    this.currentShape = document.querySelector(shapeId);
    console.log("shapeId: " + shapeId);
    console.log("shape: " + this.currentShape.id);

    this.currentShape.addEventListener("landed", this.listeners.shapeLanded);

  },

  shapeLanded: function() {
    // When one shape lands, we generate the next.
    console.log("Landed event detected: arena: " + this.arena.id);
    console.log("Create another shape from generator: " + this.generator.id);

    if (!this._arena.arenaFullIndicator) {
      this._generator.generateShape(this.focus);
    }

  },

  startGame: function() {

    // Only start the game if we are at "Game Over"
    // (which includes the initial arena state.)
    // *and* in focus
    if ((this.gameOver) && (this.focus)) {

      // There may be an old game to clear up, so clear the arena first.
      this._arena = this.arena.components.arena;
      this._arena.clearArena();

      // We are now in a game.
      this.gameOver = false;


      // Started event allows environment to update to reflect the fact That
      // we are now in-game
      // (start event won't start us if the game is not in focus, so is
      //  not a reliable indicator that the game has started.)
      this.el.emit("started");

      // Reset the score, level etc.  Level will increment to 1 on the first
      // tick - and that's when we'll update the scoreboard.
      this.score = 0;
      this.gameTimeSecs = 0;
      this.level = 0;
      this.changedLevelTime = 0;

      // Reach into generator internals to update speed.
      // Not ideal, but should work for now.
      this.blockFallSpeed = this.data.initialspeed;
      this._generator.setSpeed(this.blockFallSpeed)

      // All ready, now generate the first shape.
      // This will also delete any shape & associated proxy that was in-flight.
      this._generator.generateShape(this.focus);
    }
  },

  onLayersRemoved: function(event) {

    // Layers removed.
    // Increase score by the square of the number of layers removed.
    // 1 point for 1 layer, 4 for 2 layers, 9 for 3 etc.
    this.score += Math.pow(event.detail.count, 2);

    console.log("Updating scoreboard");
    this.scoreboard.setAttribute("text", "value: Score:" + this.score);
  },

  onArenaFull: function(event) {
    console.log("Game Over")
    this.gameOver = true;
    this.el.emit("game-over",
                 {score: this.score,
                  level: this.level,
                  gametime: this.gameTimeSecs},
                 false);
  },

  onFocus: function() {
    // turn controls back on for the current shape.
    this.focus = true;

    console.log("Focussing " + this.el.id);
    if (this.currentShape) {
      console.log("Focussing " + this.currentShape.id);
      this.currentShape.emit("focus");
    }

    // Any changes to displayed text, content etc. in the scene is best
    // handled using event-set, and the _target: selector on the tetrisgame
    // element.

  },

  onDefocus: function() {
    // turn controls off for the current shape.
    this.focus = false;
    console.log("Defocussing " + this.el.id);
    if (this.currentShape) {
      console.log("Defocussing " + this.currentShape.id);
      this.currentShape.emit("defocus");
    }

    // Any changes to displayed text, content etc. in the scene is best
    // handled using event-set, and the _target: selector on the tetrisgame
    // element.
  },

  updateScoreboard: function() {

    var scoreboardText = "value:"
    var gameTimeMins = Math.floor(this.gameTimeSecs / 60);
    var gameTimeSecsRemainder = this.gameTimeSecs % 60
    scoreboardText += "Time: " + gameTimeMins + ":" +
                      gameTimeSecsRemainder.toString().padStart(2,'0') + "\n";
    scoreboardText += "Level: " + this.level + "\n";
    scoreboardText += "Score: " + this.score + "\n";

    this.scoreboard.setAttribute("text", scoreboardText);
  },

  tick: function(time, timeDelta) {

    // updates to make when in game:
    if (!this.gameOver)
    {

      // Update the level as per config (every minute by default)
      // Or if we are starting the game, record that time.
      if (this.changedLevelTime == 0) {
        // new game
        this.changedLevelTime = time;
        this.level++;
        this.gameStartTime = time;
        this.gameTimeSecs = 0;
        this.updateScoreboard();
      }
      else if (time - this.changedLevelTime > this.levelDurationMsecs) {
        // move up a level.
        this.level++;
        this.changedLevelTime = time;
        this.blockFallSpeed = this.blockFallSpeed * this.levelSpeedMultiplier;

        // Reach into generator internals to update speed.
        // Not ideal, but should work for now.
        this._generator.setSpeed(this.blockFallSpeed)
      }

      // Update the scoreboard every second.
      if (time - this.lastScoreboardTime > 1000) {
        this.lastScoreboardTime = time;
        this.gameTimeSecs = Math.floor((time - this.gameStartTime) / 1000);
        this.updateScoreboard();
      }
    }

    if (this.data.debug) {
      var logtext = `Focus: ${this.focus}\n`
      if (this.currentShape) {
        logtext += `Shape Focus: ${this.currentShape.components.falling.infocus}\n`
      }
      var logPanel = document.querySelector(this.data.logger);
      logPanel.setAttribute('text', "value: " + logtext);
    }
  }
});

// Generate shapes.
AFRAME.registerComponent('shapegenerator', {
  schema: {
    arena:           {type: 'selector', default: '#arena'},
    shapes:          {type: 'array', default: ["EEE","EEN","ENE","ENSE","ENW","ENSD","EDN"]},
    keys:            {type: 'string', default: [`KeyY=zminus,
                                                 KeyH=zplus,
                                                 KeyG=xminus,
                                                 KeyJ=xplus,
                                                 Numpad8=xRotMinus,
                                                 Numpad5=xRotPlus,
                                                 Numpad4=yRotPlus,
                                                 Numpad6=yRotMinus,
                                                 Numpad7=zRotMinus,
                                                 Numpad9=zRotPlus,
                                                 Space=$drop,
                                                 #rhand.abuttondown=$drop,
                                                 #rhand.abuttonup=%%drop`]},
    movecontrol:    {type: 'array', default: ["#lhand.thumbstick","#rhand.grip"]},
    rotatecontrol:  {type: 'array', default: ["#lhand.thumbstick","#rhand.trigger"]},
    speed:          {type: 'number', default: 1000},
    nextshape:      {type: 'selector'},
    globalmixin:    {type: 'string', default: "cube"},
    pershapemixin:  {type: 'string', default: ""},
    arenapershapemixin:  {type: 'string', default: ""},
    debug:          {type: 'boolean', default: false},
    logger1:        {type: 'string', default: "#log-panel1"},
    logger2:        {type: 'string', default: "#log-panel2"}

  },
  init: function () {
    this.shapeIndex = 0;
    this.nextShapeChoice = 0;
    this.shapeGenWorldPosition = new THREE.Vector3;
    this.positionInArenaSpace = new THREE.Vector3(0, 0, 0);

    // long list of colours to accommodate many shape configs.
    // Current max is 2D Pentris with 18 shapes.
    this.shapeColors = [
      "#FF0",
      "#00F",
      "#FFF",
      "#F0F",
      "#0FF",
      "#0F0",
      "#F00",
      "#888",
      "#F80",
      "#F08",
      "#8F0",
      "#0F8",
      "#80F",
      "#08F",
      "#F88",
      "#8F8",
      "#88F",
      "#8FF",
      "#FF8",
      "#F8F"]
  },

  update: function () {

    // String representing debug mode, to use to configure components.
    this.debugString = this.data.debug ? "debug:true" : "debug: false";
    this.logger1String = this.data.debug ? `logger:${this.data.logger1}` : "";
    this.logger2String = this.data.debug ? `logger:${this.data.logger2}` : "";

    // Speed config.  This changes over time...
    this.setSpeed(this.data.speed);

    // Set up configured controls.
    this.sixdofController = "";
    this.moveControls = {thumbstick:  "",
                         sixdof: ""};
    this.rotateControls = {thumbstick:  "",
                           sixdof: ""};
    this.storeControlsConfig(this.data.movecontrol, this.moveControls);
    this.storeControlsConfig(this.data.rotatecontrol, this.rotateControls);

    /* This is experimental function where controls are enabled/disabled
    * based on direction of view.
    * it is dependent on the "attention" component.
    * Not clear whether this is a good mechanism, and whether we should maintain
    * it.  Proximity-based solutions are probably simpler */
    if (this.data.camera !== "") {
      this.camera = document.querySelector(this.data.camera)
      this.attentionTracking = true;
    }
    else {
      this.attentionTracking = false;
    }
    /* End experimental code */

    // clear out any previous shape models.
    this.shapeModels = [];

    this.data.shapes.forEach((item, index) => {

      /* String consists of a sequence of compass and up/down directions: EWNSUD
       *
       * We map to an array of [x, y, z] co-ordinates represnting the component
       * blocks.
       * Typically we have 3 compass directions & 4 co-ordinates.
       * But shapes might be any number of blocks (different variants)
       * and sometimes the compasss directions double back (e.g. for T)
       * We handle this case, and de-duplicate as necessary. */
       shapeData = this.shapeDataFromCompassData(item);
       this.shapeModels.push(shapeData);
     });

     // Now we have processed the shapes, set one up as our "Next shape".
     this.nextShapeChoice = this.selectRandomShape();
   },

  storeControlsConfig: function(configArray, controlsData) {

    configArray.forEach((item) => {
      config = item.split(".");

      // For back-compatibility, if no cotroller is specified, assume #rhand
      // and warn.
      if (!config[1]) {
        config[1] = config[0];
        config[0] = "#rhand";
        console.warn("Controller specification missing.  Assuming #rhand");
      }

      switch (config[1]) {
        case "either":
        // Either is deprecated on this interface, in favour of an array of
        // values, but can be handled the same as "grip" or "trigger.
        console.warn("'either' setting deprecated.  See README for latest interface definition.");
        case "grip":
        case "trigger":
          if ((this.sixdofController !== "") &&
              (this.sixdofController !== config[0])) {
            console.warn(`sixdof controls cannot be split across multiple controllers.  Choosing ${config[0]} over ${this.sixdofController}`);
          }
          this.sixdofController = config[0];

          if ((controlsData.sixdof !== "") &&
              (controlsData.sixdof !== config[1])) {
            controlsData.sixdof = "either";
          }
          else
          {
            controlsData.sixdof = config[1];
          }
          break;

        case "thumbstick":
          controlsData.thumbstick = config[0];
          break;

        case "none":
          console.warn("Value 'none' is deprecated.  See README for latest interface.");
          break;

        default:
          console.warn("Unexpected config: " + item);
          break;
       }
    });
  },

  shapeDataFromCompassData: function(compassString) {

    // build the shape starting at 0, 0, 0.
    blockData = [0, 0, 0]
    shapeData = [];

    // Push a copy of block data into shape data.
    shapeData.push(blockData.map((x) => x));
    var xTotal = 0;
    var yTotal = 0;
    var zTotal = 0;

    for (var ii = 0; ii < compassString.length; ii++) {

      // N/S are z axis.
      // E/W are x axis.
      // U/D are y-axis
      switch (compassString.charAt(ii)) {

        case 'N':
          blockData[2] -=1;
          break;

        case 'S':
          blockData[2] +=1;
          break;

        case 'E':
          blockData[0] -=1;
          break;

        case 'W':
          blockData[0] +=1;
          break;

        case 'U':
          blockData[1] +=1;
          break;

        case 'D':
          blockData[1] -=1;
          break;

        default:
        // Bad config.
        console.log(`Unexpected character in shape data: ${compassString.charAt[ii]}`)
      }

      /* Now add this row, if it is not a duplicate... */
      if (!shapeData.find((item) => ((item[0] == blockData[0]) &&
                                     (item[1] == blockData[1]) &&
                                     (item[2] == blockData[2])))) {

        console.log(`Adding block data: x: ${blockData[0]}, y: ${blockData[1]}, z: ${blockData[2]}`)
        shapeData.push(blockData.map((x) => x));

        /* Keep a running total of the positions, used for centering later */
        xTotal += blockData[0]
        yTotal += blockData[1]
        zTotal += blockData[2]

      }
    }

    /* Finally, center the shape as best we can.
       to get optimal rotation behaviour, we align to the nearest
       half-block (which can lead to non-aligned rotations), and then snap
       back to the grid after rotation. */

    var xShift = Math.round(xTotal/shapeData.length * 2)/2;
    var yShift = Math.round(yTotal/shapeData.length * 2)/2;
    var zShift = Math.round(zTotal/shapeData.length * 2)/2;
    /* We had also experimented with completely natural centers of rotation
    No string argument against this, but it does seem to increase the potential
    range of scenarios to consider...
    var xShift = xTotal/shapeData.length;
    var yShift = yTotal/shapeData.length;
    var zShift = zTotal/shapeData.length;*/

    console.log(`Recentering.  Shift by x:${xShift}, y: ${yShift}, z: ${zShift}`)
    shapeData.forEach((item, index) => {

      item[0] -= xShift;
      item[1] -= yShift;
      item[2] -= zShift;

    });

    return(shapeData);
  },

  setSpeed: function(newSpeed) {
    this.speed = newSpeed;
  },

  deleteAllObjectsWithClass: function(targetClass) {

    var elementsToDelete = document.querySelectorAll("." + targetClass);
    for (var ii = 0; ii < elementsToDelete.length; ii++) {
      console.log("Destroying element:" + elementsToDelete[ii].id);
      elementsToDelete[ii].parentNode.removeChild(elementsToDelete[ii]);
    }
  },

  selectRandomShape: function() {
    return(Math.floor(Math.random() * (this.shapeModels.length)));
  },

  createShapeElement: function(elementId,
                               shapeClass,
                               modelChoice,
                               proxy,
                               nextShape,
                               targetId,
                               inFocus) {
    var entityEl = document.createElement('a-entity');

    entityEl.setAttribute("id", elementId);
    entityEl.setAttribute('class', shapeClass);

    if (proxy) {
      // Disable debugging - too verbose & gets in the way of debugging problems
      // with tetris-engine...
      entityEl.setAttribute('sixdof-control-proxy',
                            `controller:${this.sixdofController};
                             move:${this.moveControls.sixdof};
                             rotate:${this.moveControls.sixdof};
                             target:#${targetId}`);
    }
    else if (nextShape)
    {
      this.data.nextshape.object3D.getWorldPosition(entityEl.object3D.position);
      this.data.arena.object3D.worldToLocal(entityEl.object3D.position);
    }
    else // regular shape in play area.  Spawn at the shape generator (its parent).
    {
      entityEl.object3D.position.copy(this.positionInArenaSpace);
      // set up Arena mixin string based on config
      var arenaMixinString = "";
      if (this.data.arenapershapemixin !== "") {
        // Separate mixin to be used once the shape lands in the arena.
        arenaMixinString = `;arenamixin:${this.data.arenapershapemixin + modelChoice.toString()}`;
      }

      entityEl.setAttribute('falling', `interval:${this.speed}; arena:#${this.data.arena.id};infocus:${inFocus}${arenaMixinString}`);
      entityEl.setAttribute('key-bindings', `debug:true;bindings:${this.data.keys}`);

      // Required conntoller config can be either or both of
      // sixdof-object-control, and thumstick-object-control.
      if (this.sixdofController !== "") {
        entityEl.setAttribute('sixdof-object-control', `proxy:#${targetId};movement:events;posgrid:relative;${this.debugString};${this.logger1String}`);
      }
      if ((this.moveControls.thumbstick !== "") ||
          (this.rotateControls.thumbstick !== "")) {
        entityEl.setAttribute('thumbstick-object-control',
                              `movement:events;
                               movestick:${this.moveControls.thumbstick};
                               rotatestick:${this.rotateControls.thumbstick}`);
      }
    }

    /* The shape center may not be grid-aligned, so snap the shape to a grid
       position in the X/Z axes. */
    /* The shape will snap to this grid at initialization. */

    // Now finalize the object by attaching it as a child of the arena.
    this.data.arena.appendChild(entityEl);

    // Now create child entities, one for each cube that makes up the shape.
    // Typically there will be 4 of these (tetris), but we support other
    // shape configs too, maybe smaller or larger...
    for (var ii = 0; ii < this.shapeModels[modelChoice].length; ii++) {
      var blockEntity = document.createElement('a-entity');
      var mixinString = this.data.globalmixin

      if (this.data.pershapemixin !== "")
      {
        // We have per-shape customization
        mixinString += " " + this.data.pershapemixin + modelChoice.toString();
      }
      blockEntity.setAttribute("mixin", mixinString);

      if (proxy) {
        // For the proxy, we override any custom colors with a semi-transparent grey.
        // Not configurable (except by making the proxy invisible).
        blockEntity.setAttribute("material", "color:#888; transparent:true; opacity:0.5");
      }
      else {
        if (this.data.pershapemixin == "") {
           // If no per-shape mixin, default behaviour is to color the blocks with
           // standard per-shape colors.
           blockEntity.setAttribute("material", "color: " + this.shapeColors[modelChoice]);
        }

        // Next Shapes don't need shadows.
        if (!nextShape) {
          blockEntity.setAttribute("shadow", "cast:true");
          // Let's try not using "snap - shouldn't be necessary as we only move in
          // unit increments anyway.
        }
      }

      blockEntity.object3D.position.set(this.shapeModels[modelChoice][ii][0] * GRID_UNIT,
                                        this.shapeModels[modelChoice][ii][1] * GRID_UNIT,
                                        this.shapeModels[modelChoice][ii][2] * GRID_UNIT);
      entityEl.appendChild(blockEntity);
    }
  },

  generateShape: function(inFocus) {

    // Make sure we have an accurate view of the relative positions of the
    // Shape Generator & Arena (may not be set up correctly in initialization
    // depending on order).
    this.el.object3D.getWorldPosition(this.positionInArenaSpace);
    this.data.arena.object3D.worldToLocal(this.positionInArenaSpace);

    const sceneEl = document.querySelector('a-scene');

    const proxyId = `proxy-${this.el.id}-${this.shapeIndex}`;
    const shapeId = `shape-${this.el.id}-${this.shapeIndex}`;
    const nextShapeId = `proxy-${this.el.id}`;

    // Label proxies & shapes with classes unique to this shape generator.
    //  This allows us to delete all entities associated with this shape
    // generator, without affecting entities generated by other shape generators.
    const proxyClass = "proxy" + this.el.id;
    const shapeClass = "shape" + this.el.id;
    const nextShapeClass = "nextShape" + this.el.id;

    // At this point, we are already committed to the next shape, but we need
    // to make a random choice for the next next shape.
    const modelChoice = this.nextShapeChoice;
    this.nextShapeChoice = this.selectRandomShape();

    // Before we create the new proxy & new shape, delete the previous ones.
    // Clearing everything up here keeps things simple & ensures we only ever
    // have one shape & one proxy in play.
    // Also clear up the previous next shape (we don't re-use it: we
    // recreate it - maybe not optimal for performance, but keeps things simple).
    this.deleteAllObjectsWithClass(proxyClass)
    this.deleteAllObjectsWithClass(shapeClass)
    this.deleteAllObjectsWithClass(nextShapeClass)

    // Now get on with the creation of the new shapes.
    // Create the Proxy (required only if sixdof - i.e. non-thumbstick -
    // controls are configured)
    if (this.sixdofController !== "") {
      this.createShapeElement(proxyId,
                              proxyClass,
                              modelChoice,
                              proxy = true,
                              nextShape = false,
                              shapeId,
                              inFocus);
    }

    this.createShapeElement(shapeId,
                            shapeClass,
                            modelChoice,
                            proxy = false,
                            nextShape = false,
                            proxyId,
                            inFocus);

    // Create the next shape display object if a next shape display is
    // configured.
    if (this.data.nextshape) {
      this.createShapeElement(nextShapeId,
                              nextShapeClass,
                              this.nextShapeChoice,
                              proxy = false,
                              nextShape = true,
                              null,
                              inFocus);
    }

    // Announce the new shape to anyone who cares, including the shapeId.
    // Specifically this is monitored by the tetrisgame component, which is
    // responsible for generating more shapes when this one lands.
    this.el.emit('new-shape', {shapeId: "#" + shapeId});

  }
});

// Falling component.
// Makes an object fall until position = 0
// Then it generates a "landed" event.
// Intervals is number of msecs between fall steps.
// Only a top-level shape should be registered as "falling"
// This handles parent + child components.
/* Some notes on the lifecycle of a shape...
 * It is created by the Shape Generator, but as a child of the Arena.
 * This means that its position is recorded relative to the Arena, which
 * makes collision calculations simple.
 * When the shape lands, it is destroyed, and it's consituent blocks are
 * recreated, also as children of the Arena, with the same space considerations.
 * We avoid any comparisons in world space,.  This means that
 * the entire game engine could be re-oriented to any orientation (including
 * sideways or upside-down, and should continue to work). */

AFRAME.registerComponent('falling', {
  schema: {
     interval: {type: 'number'},
     arena: {type: 'selector'},
     shapeindex: {type: 'string'},
     infocus: {type: 'boolean', default: true},
     arenamixin: {type: 'string', default: ""}
   },

   init: function () {
     this.landed = false;
     this.arenaEl = this.data.arena;
     this._arena = this.arenaEl.components.arena;
     this.interval = this.data.interval;
     this.startHeight = this.el.object3D.position.y;
     this.infocus = this.data.infocus;

     // watch for race conditions.
     this.testingNewPosition = false;

     this.listeners = {
       move: this.moveEventHandler.bind(this),
       rotate: this.rotateEventHandler.bind(this),
       xminus: this.xminus.bind(this),
       xplus: this.xplus.bind(this),
       zminus: this.zminus.bind(this),
       zplus: this.zplus.bind(this),
       xRotPlus: this.xRotPlus.bind(this),
       xRotMinus: this.xRotMinus.bind(this),
       yRotMinus: this.yRotMinus.bind(this),
       yRotPlus: this.yRotPlus.bind(this),
       zRotPlus: this.zRotPlus.bind(this),
       zRotMinus: this.zRotMinus.bind(this),
       drop: this.drop.bind(this),
       focus: this.onFocus.bind(this),
       defocus: this.onDefocus.bind(this)
     };

     // Save off a couple of vectors for the shape that we use to be more
     // generous about allowing rotations along the longest axis when close
     // to an edge.
     this.setSaveRotationVectors();

     // Add a micro adjustment > than any FP maths inaccuracies,
     // to take away any ambiguities that might arise from block positions
     // that are right on the boundary.
     // When these happen they can result in unpredictable behaviour.
     // This addresses the fact that there is a natural bias towards the top
     // left of the board (x = 0, z = 0) for even-shaped arenas,
     // and minor errors in FP arithmetic can lead to shapes spawning out of
     // position (e.g. 4-bar spawning outside the 4x4 arena)
     this.el.object3D.position.x += GRID_UNIT/100;
     this.el.object3D.position.z += GRID_UNIT/100;

     // Now snap the shape to the grid.
     this.snapToGridXZ();
   },

   snapToGridXZ: function() {

     /* The requirement is that the child blocks (in Arena position) are aligned
        with the arena grid.
        Aligning one block is sufficient as they'll all have the same misalignment
        We apply the re-alignment at the parent shape, not the block. */

     // Get arena position of the first child block.
     var arenaPosition = new THREE.Vector3();
     const firstChild  = Array.from(this.el.childNodes)[0];
     if (firstChild) {
       firstChild.object3D.getWorldPosition(arenaPosition);
       this.arenaEl.object3D.worldToLocal(arenaPosition)
       if (this.data.debug) {
         console.log("Raw Shape X:" + this.el.object3D.position.x)
         console.log("Raw Shape Z:" + this.el.object3D.position.z)

         console.log("Raw Block X:" + arenaPosition.x)
         console.log("Raw Block Z:" + arenaPosition.z)
       }

       // Find x & z offsets from grid.

       const offsetX = arenaPosition.x - (Math.round(arenaPosition.x / GRID_UNIT) * GRID_UNIT)
       const offsetZ = arenaPosition.z - (Math.round(arenaPosition.z / GRID_UNIT) * GRID_UNIT)

       if (this.data.debug) {
         console.log("Snap offset X:" + offsetX)
         console.log("Snap offset Z:" + offsetZ)
       }

       // Apply these to the shape.
       this.el.object3D.position.x -= offsetX;
       this.el.object3D.position.z -= offsetZ;

       if (this.data.debug) {
         console.log("Adjusted Shape X:" + this.el.object3D.position.x)
         console.log("Adjusted Shape Z:" + this.el.object3D.position.z)
       }

       // Check for position that is very close to a boundary.
       // I'm concerned about these, as possible cause of bugs where
       // blank spaces get misidentified as being "filled" and vice versa.
       // Unfortunately not clear what to do about these issues...
       // Putting a small adjustment in prior to snapping led to a "drift" issue
       // where rotating a block many times led to it drifting to the right.
       // Latest testing is not showing up any actual issues, so we'll leave
       // the warnings in, but not worry for now.
       if (Math.round(arenaPosition.x / GRID_UNIT) !== Math.round((arenaPosition.x + 0.0001) / GRID_UNIT)) {
         console.warn("WARNING: X offset close to boundary" + this.el.id + " - " + arenaPosition.x)
       }
       if (Math.round(arenaPosition.x / GRID_UNIT) !== Math.round((arenaPosition.x - 0.0001) / GRID_UNIT)) {
         console.warn("WARNING: X offset close to boundary" + this.el.id + " - " + arenaPosition.x)
       }
       if (Math.round(arenaPosition.z / GRID_UNIT) !== Math.round((arenaPosition.z + 0.0001) / GRID_UNIT)) {
         console.warn("WARNING: Z offset close to boundary" + this.el.id + " - " + arenaPosition.z)
       }
       if (Math.round(arenaPosition.z / GRID_UNIT) !== Math.round((arenaPosition.z - 0.0001) / GRID_UNIT)) {
         console.warn("WARNING: Z offset close to boundary" + this.el.id + " - " + arenaPosition.z)
       }
     }
   },

   play: function () {

     if (this.infocus) {
       this.attachEventListeners();
     }
     else {
       this.el.addEventListener('focus', this.listeners.focus, false);
       this.el.addEventListener('defocus', this.listeners.defocus, false);
     }
   },

   pause: function () {
     this.removeEventListeners();
   },

   setSaveRotationVectors: function() {

    this.saveRotationVector1 = new THREE.Vector3(0, 0, 0);
    this.saveRotationVector2 = new THREE.Vector3(0, 0, 0);

     // Loop through each sub-component in the shape to figure out the
     // longest dimension.
     var childrenArray = Array.from(this.el.childNodes);
     var xMin = 1;
     var xMax = -1;
     var yMin = 1;
     var yMax = -1;
     var zMin = 1;
     var zMax = -1;

     for (ii = 0; ii < childrenArray.length; ii++) {
       // Determine range of x, y & z in this shape
       // (in default orientation).
       var xPos = childrenArray[ii].object3D.position.x;
       var yPos = childrenArray[ii].object3D.position.y;
       var zPos = childrenArray[ii].object3D.position.z;

       xMin = (xPos < xMin) ? xPos : xMin
       xMax = (xPos > xMax) ? xPos : xMax
       yMin = (yPos < yMin) ? yPos : yMin
       yMax = (yPos > yMax) ? yPos : yMax
       zMin = (zPos < zMin) ? zPos : zMin
       zMax = (zPos > zMax) ? zPos : zMax
     }

     if ((xMax - xMin > yMax - yMin) &&
         (xMax - xMin > zMax - zMin)) {
        // x is longest dimension
        this.saveRotationVector1.set(GRID_UNIT, 0, 0)
        this.saveRotationVector2.set(-GRID_UNIT, 0, 0)
      }
      else if ((yMax - yMin > xMax - xMin) &&
               (yMax - yMin > zMax - zMin)) {
        // y is the longest dimension
        this.saveRotationVector1.set(0, GRID_UNIT, 0)
        this.saveRotationVector2.set(0, -GRID_UNIT, 0)
      }
      else if ((zMax - zMin > xMax - xMin) &&
               (zMax - zMin > yMax - yMin)) {
        // z is the longest dimension
        this.saveRotationVector1.set(0, 0, GRID_UNIT)
        this.saveRotationVector2.set(0, 0, -GRID_UNIT)
      }
   },

   onFocus: function () {
     console.log("Focussing " + this.el.id);
     this.attachEventListeners();
     this.infocus = true;
   },

   onDefocus: function () {
     console.log("Defocussing " + this.el.id);
     this.removeEventListeners();
     this.infocus = false;
   },

   remove: function () {
     this.pause();
   },

   attachEventListeners: function () {
     // These are the events we receive when bound to a 6dof controller.
     this.el.addEventListener('move', this.listeners.move, false);
     this.el.addEventListener('rotate', this.listeners.rotate, false);

     // These are the events we receive when bound to keyboard controls.
     this.el.addEventListener('xminus', this.listeners.xminus, false);
     this.el.addEventListener('xplus', this.listeners.xplus, false);
     this.el.addEventListener('zminus', this.listeners.zminus, false);
     this.el.addEventListener('zplus', this.listeners.zplus, false);
     this.el.addEventListener('xRotMinus', this.listeners.xRotMinus, false);
     this.el.addEventListener('xRotPlus', this.listeners.xRotPlus, false);
     this.el.addEventListener('yRotMinus', this.listeners.yRotMinus, false);
     this.el.addEventListener('yRotPlus', this.listeners.yRotPlus, false);
     this.el.addEventListener('zRotMinus', this.listeners.zRotMinus, false);
     this.el.addEventListener('zRotPlus', this.listeners.zRotPlus, false);
     this.el.addEventListener('drop', this.listeners.drop, false);
     this.el.addEventListener('focus', this.listeners.focus, false);
     this.el.addEventListener('defocus', this.listeners.defocus, false);

     // Note: We never remove focus/defocus Event Listeners.
   },

   removeEventListeners: function () {
     // These are the events we receive when bound to a 6dof controller.
     this.el.removeEventListener('move', this.listeners.move);
     this.el.removeEventListener('rotate', this.listeners.rotate);

     // These are the events we receive when bound to keyboard controls.
     this.el.removeEventListener('xminus', this.listeners.xminus);
     this.el.removeEventListener('xplus', this.listeners.xplus);
     this.el.removeEventListener('zminus', this.listeners.zminus);
     this.el.removeEventListener('zplus', this.listeners.zplus);
     this.el.removeEventListener('xRotMinus', this.listeners.xRotMinus);
     this.el.removeEventListener('xRotPlus', this.listeners.xRotPlus);
     this.el.removeEventListener('yRotMinus', this.listeners.yRotMinus);
     this.el.removeEventListener('yRotPlus', this.listeners.yRotPlus);
     this.el.removeEventListener('zRotMinus', this.listeners.zRotMinus);
     this.el.removeEventListener('zRotPlus', this.listeners.zRotPlus);
     this.el.removeEventListener('drop', this.listeners.drop);

     // Note: We never remove focus/defocus Event Listeners.
   },

   moveEventHandler: function(event) {
     // received "move" event from 6doF controller.
     // the event data just contains the abolute new position.

     console.log("Move Event from 6DOF Controller")
     TETRISlogXYZ("Move data: ", event.detail, 2, true);

     // Overwrite the y data point with the current position.
     event.detail.y = this.el.object3D.position.y;

     this.moveAbsolute(event.detail);
   },

   moveAbsolute: function(newPosition) {
     // Is the new position viable?
     // Just move the shape, and see how it goes.
     var oldPosition = AFRAME.utils.clone(this.el.object3D.position);

     //TETRISlogXYZ("Testing movement to position: ", this.el.object3D.position, 2, true);
     this.testingNewPosition = true;
     this.el.object3D.position.copy(newPosition)

     // Don't assume the new position is on-grid.
     // Carious possible centers of rotation for shapes can lead to shapes ending
     // up off-grid, even if they are only moved in whole unit increments.
     // This can happen if they are rotated while moving.
     // (not possible with key controls, but possible with 6DoF controls).
     // The 6doF controller doesn't have enough knowledge of the shape grid to
     // consistently get this right, so we need to get it right here.
     this.snapToGridXZ();

     //TETRISlogXYZ("Trying to move shape to:", newPosition, 2, true);
     //TETRISlogAllBlockPositions(this.el);

     if (this.canShapeMoveHere(this.el, {'x': 0, 'y': 0, 'z': 0})) {
       // The move worked fine.
       moved = true;
     }
     else {
       // revert.
       //TETRISlogXYZ("Undoing position move to: ", this.el.object3D.position, 2, true);
       this.el.object3D.position.copy(oldPosition)
       //TETRISlogXYZ("Reverted to: ", this.el.object3D.position, 2, true);
       //TETRISlogAllBlockPositions(this.el);
       moved = false;
     }
     this.testingNewPosition = false;

     return(moved);
   },

   // returns true if moved, false otherwise.
   moveRelative: function(xMove, yMove, zMove) {

     var newPosition = new THREE.Vector3();
     newPosition.copy(this.el.object3D.position);
     newPosition.x += xMove;
     newPosition.y += yMove;
     newPosition.z += zMove;

     var moved = this.moveAbsolute(newPosition);

     return(moved);
   },

   rotateEventHandler: function(event) {
     // received "rotate" event from 6doF controller.
     // the event data contains the Quaternion for the abolute new rotation.

     console.log("Rotate Event from 6DOF Controller")
     TETRISlogQuat("Rotate data: ", event.detail, 1, true);

     this.rotateAbsolute(event.detail);
   },

   rotateAbsolute: function(quaternion) {

     TETRISlogQuat("Trying to rotate shape to:", quaternion, 1, true);

     // Before we rotate, save off the old quaternion & position.
     var oldQuaternion = new THREE.Quaternion();
     oldQuaternion.copy(this.el.object3D.quaternion);
     var oldPosition = new THREE.Vector3();
     oldPosition.copy(this.el.object3D.position);
     var undo = false;

     // Apply the new (absolute) rotation.
     // Copy, not multiply, as this is an absolute rotation,
     // not a relative one.
     TETRISlogXYZ("Testing rotation at position: ", this.el.object3D.position, 2, true);

     console.log("pre-rotation");
     TETRISlogAllBlockPositions(this.el);
     this.testingNewPosition = true;
     this.el.object3D.quaternion.copy(quaternion);
     // Rotation may have misaligned blocks from grid, so snap back.
     this.snapToGridXZ();

     console.log("post-rotation");
     TETRISlogAllBlockPositions(this.el);

     var rotated;
     // Is the new position viable?
     if (this.canShapeMoveHere(this.el, {'x': 0, 'y': 0, 'z': 0})) {
       // Yes, the move is viable.  Leave it in place.
       TETRISlogXYZ("Completed rotation at position: ", this.el.object3D.position, 2, true);
       TETRISlogAllBlockPositions(this.el);
       rotated = true;
     }
     else {
       // There is a case we want to allow for, where we enable a small translation
       // to enable the rotation.
       // But only when a move of +/-1 along the shape's longest dimension
       // would be enough to enable the rotation.
       // Vectors to check are the base "save rotation vectors" set up when
       // we initialize the shape, with the rotation quaternion applied to them.
       undo = true;
       var srv1 = this.saveRotationVector1.clone();
       srv1.applyQuaternion(quaternion);
       logXYZ("SRV1", srv1, 16, true);
       var srv2 = this.saveRotationVector2.clone();
       srv2.applyQuaternion(quaternion);
       logXYZ("SRV2", srv2, 16, true);

       if (this.canShapeMoveHere(this.el, srv1)) {
         console.log("applied SRV1")
         this.el.object3D.position.add(srv1);
         this.snapToGridXZ();
         // Double check shape can move here after snapping to position.
         if (this.canShapeMoveHere(this.el, {'x': 0, 'y': 0, 'z': 0})) {
           undo = false;
         }
       }
       else if (this.canShapeMoveHere(this.el, srv2)) {
         console.log("applied SRV2")
         this.el.object3D.position.add(srv2);
         this.snapToGridXZ();
         // Double check shape can move here after snapping to position.
         if (this.canShapeMoveHere(this.el, {'x': 0, 'y': 0, 'z': 0})) {
           undo = false;
         }
       }

       if (undo) {
         // Undo the rotation.
         TETRISlogXYZ("Undoing rotation at position: ", this.el.object3D.position, 2, true);
         this.el.object3D.quaternion.copy(oldQuaternion);
         this.el.object3D.position.copy(oldPosition);
         this.snapToGridXZ();
         rotated = false;
         TETRISlogAllBlockPositions(this.el);
       }
     }
     this.testingNewPosition = false;

     return(rotated);
   },

   rotateRelative: function(xRad, yRad, zRad) {
     console.log("Trying to rotate shape")

     // to compose rotations reliably, we use Quaternion arithmetic.
     var eulerDelta = new THREE.Euler(xRad, yRad, zRad);
     var quaternionDelta = new THREE.Quaternion();
     quaternionDelta.setFromEuler(eulerDelta);

     // Get Absolute new rotation as a quaternion, by multiplying
     // current rotation by this delta.
     var quaternionAbsolute = new THREE.Quaternion();
     quaternionAbsolute.multiplyQuaternions(this.el.object3D.quaternion,
                                            quaternionDelta);

     // To determine whether we can rotate the shape, we just do the rotation,
     // then check if the position is viable.
     // If not, we can undo before any rendering takes place.
     rotated = this.rotateAbsolute(quaternionAbsolute)

     return(rotated);
   },

   zminus: function (event) {
     console.log("zminus");
     this.moveRelative(0, 0, -GRID_UNIT);
   },
   zplus: function (event) {
     console.log("zplus");
     this.moveRelative(0, 0, GRID_UNIT);
   },
   xminus: function (event) {
     console.log("xminus");
     this.moveRelative(-GRID_UNIT, 0, 0);
   },
   xplus : function (event) {
     console.log("xplus");
     this.moveRelative(GRID_UNIT, 0, 0);
   },

   xRotPlus: function (event) {
     console.log("xRotPlus");
     this.rotateRelative((Math.PI / 2), 0, 0);
   },
   xRotMinus: function (event) {
     console.log("xRotMinus");
     this.rotateRelative(-(Math.PI / 2), 0, 0);
   },
   yRotPlus: function (event) {
     console.log("yRotPlus");
     this.rotateRelative(0, (Math.PI / 2), 0);
   },
   yRotMinus: function (event) {
     console.log("yRotMinus");
     this.rotateRelative(0, -(Math.PI / 2), 0);
   },
   zRotPlus: function (event) {
     console.log("zRotPlus");
     this.rotateRelative(0, 0, (Math.PI / 2));
   },
   zRotMinus: function (event) {
     console.log("zRotMinus");
     this.rotateRelative(0, 0, -(Math.PI / 2));
   },
   drop: function (event) {
     // instant 5x multiplier to shape-fall speed.
     // This is the old behaviour, still maintained.
     // but preferred implementation is now via the "drop" state
     // so that acceleration only happens while the key is held down.
     // That can be set using "$drop" as a binding in key-bindings.js, in
     // place of "drop" - this is the new default.
     console.log("drop");
     this.interval = this.data.interval / 5;
   },

   canShapeMoveHere: function (element, moveVector) {

     var canMove = true;
     var worldPosition = new THREE.Vector3();
     var arenaPosition = new THREE.Vector3();

     // Loop through each sub-component in the shape.  If any one can't move, the
     // whole thing can't fall.
     childrenArray = Array.from(element.childNodes);

     for (ii = 0; ii < childrenArray.length; ii++) {

       // Block positions are relative to parent shape.
       // We need them in arena space.
       childrenArray[ii].object3D.getWorldPosition(worldPosition);
       arenaPosition.copy(worldPosition)
       this.arenaEl.object3D.worldToLocal(arenaPosition)

       // This gives us the center of the shape.  Which is exactly what we want
       // to use to check position - safest co-ordinates to map to the cells matrix
       // maintained to track arena state.

       // Now add the proposed Move Vector
       arenaPosition.x += moveVector.x;
       arenaPosition.y += moveVector.y;
       arenaPosition.z += moveVector.z;

       if (!this._arena.isOpenSpace(arenaPosition)) {
         // we found a component that can't move.
         // So the whole object can't move.
         canMove = false;

         TETRISlogXYZ("Block at this position can't move", arenaPosition, 2, true);
         TETRISlogXYZ("Parent shape position is", this.el.object3D.position, 2, true);
         break;
       }
       else {
         //TETRISlogXYZ("Block at this position is OK", worldPosition, 2, true);
       }
     }

     return (canMove);
   },

   // Identify bugs quickly by consistency-checking various aspects of the shape
   verifyShape: function () {

     var worldPosition = new THREE.Vector3();
     var arenaPosition = new THREE.Vector3();
     var childrenArray = Array.from(this.el.childNodes);
     var roundedX;
     var roundedZ;

     for (ii = 0; ii < childrenArray.length; ii++) {
       // Every block's arena XZ position should be close to a multiple of
       // GRID_UNIT.
       // our snap logic is intended to ensure this.
       childrenArray[ii].object3D.getWorldPosition(worldPosition);
       arenaPosition.copy(worldPosition)
       this.arenaEl.object3D.worldToLocal(arenaPosition)

       roundedX = Math.round(arenaPosition.x/GRID_UNIT) * GRID_UNIT;
       roundedZ = Math.round(arenaPosition.z/GRID_UNIT) * GRID_UNIT;

       assert(Math.abs(arenaPosition.x - roundedX) < GRID_UNIT/10, "X not aligned");
       assert(Math.abs(arenaPosition.z - roundedZ) < GRID_UNIT/10, "Z not aligned");
     }

     function assert(condition, message) {
       if (!condition) {
         throw new Error(message || "Assertion failed");
       }
     }
   },

   tick: function (time, timeDelta) {
     // Check whether we crossed over a time boundary.
     //console.log("CLOCK: Tick called");

     // We are assuming tick won't be called while we are
     // testing out a new position.
     //console.log(!this.testingNewPosition);

     if (this.data.debug) {
       this.verifyShape();
     }

     // Only blocks that haven't landed fall.
     if (!this.landed) {

       // Logic depends whether we are falling continuously or falling a block
       // at a time.
       var distanceToFall;

       // Track whether we landed (i.e. wanted to fall but couldn't).
       var justLanded = false;

       // speed is modified based on the "drop" state.
       var interval = this.el.is("drop") ? this.interval / 10 : this.interval;

       if (CONTINUOUS) {
         // Continuous movement.
         // Speed should be GRID_UNIT distance per interval msecs.
         if (timeDelta > 0) {
           distanceToFall = (GRID_UNIT * timeDelta) / interval;
           //TETRISlogXYZ("Object falling at position: ", this.el.object3D.position, 2, true);
           justLanded = !(this.moveRelative(0, -distanceToFall, 0));

           while (distanceToFall > (GRID_UNIT / 25)) {
             // Block fell > 4mm (default units)
             // Since block falls at 10cm/second, this
             // only happens if we drop below 25 frames per second.
             // It also happens if A-Frame is paused (e.g. we enter the
             // inspector).
             // in this case, rather than leaving the block in the air,
             // make a soft descent to the playing surface.

             // Halve the distance to fall, and either fall or don't fall
             // (we don't care which).
             // We should end up within 4mm of the play surface which is a
             // good enough outcome.
             distanceToFall = distanceToFall / 2;
             this.moveRelative(0, -distanceToFall, 0);
           }
         }
       }
       else {
         // discrete movement.
         // we fall GRID_UNIT every this.interval msecs.
         var last_time = time - timeDelta;
         var remainderNow = time % (interval);
         var lastRemainder = last_time % (interval);

         if (remainderNow < lastRemainder) {
           // We just crossed a time interval.  So make the object descend.

           justLanded = !(this.moveRelative(0, GRID_UNIT, 0));
         }
       }

       if (justLanded) {

         // if we are at or above our start point, then this is game over.
         // that trumps any processing for the fact that the piece has landed.
         if (this.el.object3D.position.y >= this.startHeight)
         {
           console.log("Game Over");
           this._arena.arenaFull();
         }

         // Processing for mainline case: piece landed.
         this.landed = true;
         console.log("Landed: Emitting Event.");
         this.el.emit('landed');

         // Deactivate controls for this shape.
         // Unecessary as we're about to destroy the object anyway.
         //this.el.setAttribute('key-bindings', `debug:true;bindings:none`);

         //this.arena.checkConsistency();

         // Integrate shape into arena surface.
         this.integrateShapeToArena(this._arena, this.el)
         // Note that arena may be inconsistent now, while new block creation
         // is underway (we delete the block objects that made up the shape,
         // and create new instances to represent the blocks as they appear
         // in the arena.

         // Destroying of the shape & proxy happens when we spawn a new shape.
         // If the shape gets left around a bit longer (e.g. Game Over with no
         // new shape spawing), it's no big deal, as it is identical in
         // appearance to the blocks that replace it.  There will just be 2
         // identical objects and nobody will notice.
       }
     }
   },

   integrateShapeToArena: function (arena, element) {

     // Use arena-specific mxin if specified, else keep the one from this.
     // element.
     var mixin = "";
     if (this.data.arenamixin !== "") {
       mixin = this.data.arenamixin
     }

     var childrenArray = Array.from(element.childNodes);

     for (ii = 0; ii < childrenArray.length; ii++) {

       arena.integrateBlock(childrenArray[ii], mixin);
     }
   }
 });

/**
 * Snap entity to the closest interval specified by `snap`.
 * Offset entity by `offset`.
 */
AFRAME.registerComponent('snap', {
  dependencies: ['position'],

  schema: {
    snap: {type: 'vec3'}
  },

  init: function () {
    this.originalPos = this.el.getAttribute('position');
  },

  update: function () {
    const data = this.data;

    const pos = AFRAME.utils.clone(this.originalPos);
    pos.x = Math.floor(pos.x / data.snap.x) * data.snap.x;
    pos.y = Math.floor(pos.y / data.snap.y) * data.snap.y;
    pos.z = Math.floor(pos.z / data.snap.z) * data.snap.z;

    this.el.setAttribute('position', pos);
  }
});

// Arena "position" is at center of the arena floor.
// This should be either directly below the dropper (when the arena dimension is
// odd) or half a block width offset from the dropper (when the arena dimension
// is even.
// "x" and "z" are the arena dimensions in block counts.
// "clear" mode is either "layer", "xline", "zline" or "anyline".  This
// configures the conditions under which blocks are cleared:
// when an entire layer is completed, or as soon as an line is completed, in the
// x direction, z direction, or both.
// if z = 1 (2D game typical config) then xline and layer are equivalent.
// in this situation, zline and anyline aren't recommended, as every block
// would be deleted as soon as it landed!

AFRAME.registerComponent('arena', {
  dependencies: ['position'],

  schema: {
    x: {type: 'number'},
    z: {type: 'number'},
    clear: {type: 'string', default: "layer"}
  },

  init: function () {

    console.log("Initializing Arena");
    this.width = this.data.x;
    this.depth = this.data.z;
    this.blocksPendingIntegrationCount = 0
    this.arenaFullIndicator = false;
    this.checkLinesAgain = false;
    this.nextBlockId = 0;

    // Falling blocks are tracked by the center of the block.
    // The cornerOffset is the offset between the arena "position"
    // and the point we want to deduct to get "cell position".
    //
    // See update() function for details on how this is calculated.
    this.cornerOffset = new THREE.Vector3();

    // Cells is a full 3d map of the whole play area, used
    // to decide where blocks can go, and when layers are completed.
    this.cellsArray = [];
  },

  update: function () {

    // Set up layer/line deletion config.
    switch (this.data.clear) {
      case "layer":
        this.deleteFullXLine = false;
        this.deleteFullZLine = false;
        break;

      case "xline":
        this.deleteFullXLine = true;
        this.deleteFullZLine = false;
        break;

      case "zline":
        this.deleteFullXLine = false;
        this.deleteFullZLine = true;
        break;

      case "anyline":
        this.deleteFullXLine = true;
        this.deleteFullZLine = true;

      default:
        console.log("Unexpected config for 'clear': " + this.data.clear);
    }

    // Since we track blocks in Arena space, it's essential that the
    // shape generator is aligned with a GRID_UNIT in Arena space.
    // This means that the non-centered offset for the cases where the
    // Arena dimensions are even must be allowed for in code, it can't be
    // be compensated for solely in HTML.
    // (though it will also need to be compensated for in HTML, as the
    // entity that shows the arena to the user (e.g. a plane) will need
    // to be offset by half a block from the arena position, to correctly
    // match with where the arena is.

    // Correct calculation established from examples:
    // width = 9 or 10.  Shape generator at cell 5.  Offset to 0 = 5
    // if cell 5 center is at 0, then cell 0 center is at -5.
    // anything from -5.5 to -4.5 should give cell 0.
    // So offset for cell index is -4.5 (we round down).
    //
    // width = 11 or 12.  Shape generator at 6.  Offset to 0 = 6
    // if cell 6 center is at 0, then cell 0 center is at -6.
    // anything from -6.5 to -5.5 should give cell 0.
    // So offset for cell index is -5.5 (we round down).
    //
    // So the correct calculation is 0.5 - floor((width + 1)/2)
    // Whole thing needs to then be scaled by GRID_UNIT.
    this.cornerOffset.x = (0.5 - Math.floor((this.width + 1) / 2)) * GRID_UNIT
    this.cornerOffset.z = (0.5 - Math.floor((this.depth + 1) / 2)) * GRID_UNIT
    this.cornerOffset.y = (GRID_UNIT / 2);

  },

  clearArena: function() {

    // Iterate through all layers, and delete them.
    // We just use the same function that we use when layers are completed.
    // Slightly inefficient, as it iterates trhough all the blocks
    // once for each layer, but simpler to re-use the code, and should be fast
    // enough.
    // We start from the top as that involves much less repositioning of blocks,
    // and matches how we delete multiple layers in-game.

    for (var ii = this.cellsArray.length - 1; ii >= 0; ii--) {
      this.removeLayer(ii);
    }

    // Technically this should be unecessary as cellsArray is cleared
    // But this gives us a robust assurance that we'll start the new game in a
    // clean state.
    this.cellsArray = []

    // clear indication that the arena is full.
    this.arenaFullIndicator = false;
  },

  arenaFull: function() {
    this.arenaFullIndicator = true;
    this.el.emit("arena-full");
  },

  // Debug function to spot any discrepancies between the displayed model
  // and the cellsArray model.

  checkConsistency: function() {

    if (this.cellsArray.length > 0) {
      var clonedCellsArray = cloneArray(this.cellsArray);
    }
    else {
      var clonedCellsArray = [];
    }

    var sceneEl = document.querySelector('a-scene');
    var blockList = sceneEl.querySelectorAll('.block' + this.el.id);

    for (blockIx = 0; blockIx < blockList.length; blockIx++) {

      var arenaPosition = new THREE.Vector3();
      // Query will include the falling block.
      // Should Ignore these Not yet written code to do this..

      // since these blocks are not children, position should be fine...
      arenaPosition = blockList[blockIx].object3D.position;

      if (arenaPosition.z !== 0) {
        // Sometimes world position is zero.  Not sure why, but pretty confident
        // these are false positives.  So ignore them.
        const cellIndex = this.arenaPositionToCellIndices(arenaPosition, true);

        if (this.cellsArray[cellIndex.y][cellIndex.x][cellIndex.z] !== 1) {
          console.log("Found object not tracked in cellsArray");
          console.log(`Position: x:${cellIndex.x}, y:${cellIndex.y}, z:${cellIndex.z}`);
        }
        // Scrub this from the cloned cells array.  This helps us check that every
        // block in the cells array is represented by a block.

        clonedCellsArray[cellIndex.y][cellIndex.x][cellIndex.z] = 0;
      }
    }

    // Check for any marked cells unaccounted for...
    for (ii = 0; ii < clonedCellsArray.length; ii++) {
      for (jj = 0; jj < clonedCellsArray[ii].length; jj++) {
        for (kk = 0; kk < clonedCellsArray[ii][jj].length; kk++) {
          //console.log (ii + " " + jj + " " + kk);
          if (clonedCellsArray[ii][jj][kk] !== 0) {
            console.log("Found cells Array data with no corresponding object");
            console.log(`Layer: ${ii}, x: ${jj}, z: ${kk}`);
          }
        }
      }
    }
  },
  // Utility function to map a position in Arena space to an index into the
  // arena cells array.
  // Object position should be passed in already in Arena space.
  arenaPositionToCellIndices: function(objectPosition, debug) {
    // Basic logic is:
    // - get corner position of arena
    // - subtract this from object position.
    // - scale down by grid unit size
    // - round to an integer, suitable for use as index into the array.
    // Vector arithmetic has not been working, so we (tediously) do
    // separate calculations for X, y & Z.

    // Extract x, y & z diffs, converting by grid units, and converting to integers.
    // Here we need to factor in difference between the corner and the center of the arena
    const xIndex = Math.floor((objectPosition.x - (this.cornerOffset.x)) / GRID_UNIT);
    const yIndex = Math.floor((objectPosition.y - (this.cornerOffset.y)) / GRID_UNIT);
    const zIndex = Math.floor((objectPosition.z - (this.cornerOffset.z)) / GRID_UNIT);

    if (this.data.debug) {
      console.log(`Object: x: ${objectPosition.x}, y: ${objectPosition.y}, z: ${objectPosition.z}`)
      console.log(`Arena corner: x:${this.cornerOffset.x}, y:${this.cornerOffset.y}, z:${this.cornerOffset.z}`)
      console.log(`Indices: x:${xIndex}, y:${yIndex}, z:${zIndex}`)
    }

    return({'x': xIndex, 'y': yIndex, 'z': zIndex});
  },

  // Is this position (a) in the arena, and (b) not occupied already?
  // Recommend that this function is called with co-ordinates in the *center* of a cell
  // To avoid edge cases when dealing with edge co-ordinates.
  // The position provided should already be converted into the Arena's
  // frame of reference.
  isOpenSpace: function (objectPosition) {
    var isOpenSpace;
    // Find the cell that maps to this position.
    const cellIndex = this.arenaPositionToCellIndices(objectPosition);
    if (this.data.debug) {
      TETRISlogXYZ("Cell Indices:", cellIndex, 2, true);
    }

    if ((cellIndex.x >= 0 && cellIndex.x < this.width) &&
        (cellIndex.z >= 0 && cellIndex.z < this.depth) &&
        (cellIndex.y >= 0)) {
      // Inside the arena.

      // Check the cells data, if it goes up high enough.
      // Note that cells data is populated as required (starts off empty
      // and fills up as the arena fills up.
      if (cellIndex.y >= this.cellsArray.length) {
        isOpenSpace = true;
      }
      else if (this.cellsArray[cellIndex.y][cellIndex.x][cellIndex.z] == 0) {
        isOpenSpace = true;
      }
      else {
        // We found a populated cell in the cells array.
        isOpenSpace = false;
      }
    }
    else {
      // Outside the arena.  Not "Open Space".
      isOpenSpace = false;
    }

    return(isOpenSpace);
  },

  // Integrate a block of a shape object that has fallen into the arena floor.
  integrateBlock: function (blockElement, mixin) {

    // Block is a child of the shape, and therefore position is in shape space.
    // Translate it into arena space via world space.
    var arenaPosition = new THREE.Vector3();
    blockElement.object3D.getWorldPosition(arenaPosition);
    this.el.object3D.worldToLocal(arenaPosition)

    var cellIndex = this.arenaPositionToCellIndices(arenaPosition, true);

    // We have seen bugs where cellIndex is an illegal value.
    // Shouldn't happen as we should check before allowing the block to move
    // but if it does happen, better to handle gracefully than to crash.
    if ((cellIndex.x < 0) || (cellIndex.x >= this.width) ||
        (cellIndex.z < 0) || (cellIndex.z >= this.depth)) {
      // Illegal x or z value.
      console.error("ERROR: Illegal X or Z Value for IntegrateBlock.");
      console.error(`Object in Arena: x: ${arenaPosition.x}, y: ${arenaPosition.y}, z: ${arenaPosition.z}`)
      console.error(`Arena corner: x:${this.cornerOffset.x}, y:${this.cornerOffset.y}, z:${this.cornerOffset.z}`)
      console.error(`Indices: x:${cellIndex.x}, y:${cellIndex.y}, z:${cellIndex.z}`)
      console.log("Block destroyed without integration to arena.");

      // Destory the old block, but don't create a new one.
      blockElement.parentNode.removeChild(blockElement);
      return;
    }

    // Now we populate cellsArray with an indication that this cell is occupied.

    // Create new layer(s) if needed.
    // (with a tall shape, we might need to create 3-4 new layers)
    var layersNeeded = cellIndex.y + 1;
    if (this.cellsArray.length < layersNeeded) {
      for (var kk = this.cellsArray.length;  kk <= layersNeeded; kk++) {
        var dataLayer = [];
        for (var ii = 0; ii < this.width; ii++) {
          var dataRow = [];
          for (var jj = 0; jj < this.depth; jj++) {
            dataRow.push(0);
          }
          dataLayer.push(dataRow);
        }

        this.cellsArray.push(dataLayer);
      }
    }

    // Now mark the new location that has been filled.
    this.cellsArray[cellIndex.y][cellIndex.x][cellIndex.z] = 1;

    // Have had loads of problems re-parenting, despite following guidance here:
    // https://github.com/aframevr/aframe/issues/2425
    // Far simpler just to create new blocks in the required locations.

    // Note that creating the new elements is *Asynchronous*
    // We want to check for any completed layers, and delete them.
    // But we don't want to do that processing until the new blocks are
    // correctly in place, or things will get into a mess!

    // We solve this problem by:
    // - Setting a counter on the Arena: blocks_to_integrate
    // - Setting the "integration-tracker" component on the new objects

    var entityEl = document.createElement('a-entity');

    if (mixin !== "") {
      entityEl.setAttribute("mixin", mixin);
    }
    else
    {
      entityEl.setAttribute("mixin", blockElement.getAttribute("mixin"));
    }

    // Color is not always covered by the mixin.  So if material is
    // present, copy that across too.
    if (blockElement.getAttribute("material")) {
      entityEl.setAttribute("material", blockElement.getAttribute("material"));
    }
    entityEl.setAttribute('id', "b" + this.nextBlockId);
    this.nextBlockId++;
    entityEl.setAttribute('class', 'block' + this.el.id);
    entityEl.setAttribute('integration-tracker', `arena: #${this.el.id}`);
    entityEl.object3D.position.copy(arenaPosition);

    // For textured blocks we also need to match the rotation.
    // Since child blocks are never rotated with respect to their parent shape
    // we can simply take the parent rotation of the shape (in arena space)
    // and apply this to each block.
    entityEl.object3D.rotation.copy(blockElement.object3D.parent.rotation);

    this.el.appendChild(entityEl);
    this.blocksPendingIntegrationCount++;

    // And destroy the old element.
    blockElement.parentNode.removeChild(blockElement);

    return;
  },

  // Called when a block is integrated into the scene.
  // i.e. when the async create process for a new block that has Landed
  // completes.
  blockIntegrated: function () {

    this.blocksPendingIntegrationCount--;

    if (this.blocksPendingIntegrationCount == 0) {

      //this.checkConsistency();

      if ((!this.deleteFullXLine) &&
          (!this.deleteFullZLine)) {
        var layersRemoved = this.removeAnyCompleteLayers();

        if (layersRemoved > 0) {
          this.el.emit("layers-removed", {count: layersRemoved});
        }

      }
      else {
        var linesRemoved = this.removeAnyCompleteLines();

        if (linesRemoved > 0) {
          // We don't have a separate event for "lines removed"
          // just re-use the layers-removed event.
          this.el.emit("layers-removed", {count: linesRemoved});
        }
      }

      //this.checkConsistency();
    }
  },

  // Remove any complete layers.
  // This is not done on a per-block basis, because we want to be able to
  // identify multiple simultaneous eliminations.
  // Also because we don't want to start moving blocks down a layer until
  // the whole shape that landed has been integrated.

  // Returns number of layers removed.
  removeAnyCompleteLayers: function () {

    var layersRemoved = 0;

    // Analyze from top to bottom, as this works better when handling multiple
    // layers disappearing in one go.
    for (var ii = this.cellsArray.length - 1; ii >= 0; ii--) {
      // A complete layer will have cell count of width x depth.
      // Assuming arena shape is a simple rectangles, which is valid for now at least...

     layerCellCount = this.cellsArray[ii].reduce((a,b) => a.concat(b)) // flatten array
                                         .reduce((a,b) => a + b);      // sum

      if (layerCellCount == (this.width * this.depth)) {
        // complete layer.
        layersRemoved ++;

        // Remove the layer.
        this.removeLayer(ii);
      }
    }
    return (layersRemoved);
  },

  // Returns number of layers removed.
  removeAnyCompleteLines: function () {

    var linesRemoved = 0;

    // When we delete a single X or Z line, this changes all the layers above it
    // so the order in which we look at layers makes a difference to what blocks
    // we delete.
    // We take the following approach:
    // - Analyze all layers for all possible lines in both X & Z dimensions, as
    //   they are at the moment the shape lands.
    // - Then based on the lines that disappeared, make blocks fall the
    //   appropriate distance.  The fall distance may be different for each
    //   column in the arena.
    // - Once all blocks have been repositioned, check for any more lines that
    //   may have now formed.
    // - Repeat until we reach a stable position (no completed lines).
    //
    // To avoid confusing players, we pause briefly (500 msecs) between each
    // phase of the above.  Otherwise they may not understand why certain layers
    // were deleted.
    //
    // That will be going on simultaneously with the next shape coming into the
    // arena.  In theory that could land before the analysis is completed, in
    // which case it will be folded into that analysis, and all the scores will
    // be combined.  In practise that's extremely unlikely to happen...

    // We report a single "linesRemoved" figure for all of this.

    // Because we are not causing blocks to fall yet, it really doesn't matter
    // what order we analyze in.  Upwards from zero is simplest!

    // We build up a table of cells indicating which are to be deleted.
    // Start analyzing in the Z axis, then layer on analysis in the X axis.
    // This design is motivated by a particular care for the case where there
    // are intersection X & Z rows being deleted.  We want to only destory one
    // block at this intersection, not two...
    cellsToDelete = [];
    for (var ii = 0; ii < this.cellsArray.length; ii++) {
      var row = []

      for (var jj = 0 ; jj < this.width; jj++) {

        var column = [];
        var deleteBlock = 0;

        if (this.deleteFullZLine) {
          var lineCellCount = this.cellsArray[ii][jj].reduce((a,b) => a + b);
          if (lineCellCount == this.depth) {
            deleteBlock = 1;
            linesRemoved++;
          }
        }

        for (var kk = 0; kk < this.depth; kk++) {
          column.push(deleteBlock);
        }
        row.push(column);
      }
      cellsToDelete.push(row);
    }

    if (this.deleteFullXLine) {
      for (var ii = 0; ii < this.cellsArray.length; ii++) {
        for (var kk = 0 ; kk < this.depth; kk++) {
          lineCellCount = 0;
          // Can't use a reduce here, as we are not iterating over
          // the lowest dimension.
          // so doing it the long-hand way.
          for (var jj = 0; jj < this.width; jj++) {
            lineCellCount += this.cellsArray[ii][jj][kk];
          }
          if (lineCellCount == this.width) {
            for (var jj = 0; jj < this.width; jj++) {
              cellsToDelete[ii][jj][kk] = 1;
            }
            linesRemoved++;
          }
        }
      }
    }

    if (linesRemoved > 0) {
      // We now do the work to remove these lines.

      // For our internal representation (this.cellsArray), we work through each
      // column in the arena, delete the blocks that are marked with a 1, and drop the blocks above by the
      // corresponding amount.
      // We work from the bottom up.

      for (var jj = 0; jj < this.width; jj++) {
        for (var kk = 0; kk < this.width; kk++) {
          var drop = 0;
          for (var ii = 0; ii < this.cellsArray.length; ii++) {
            if (cellsToDelete[ii][jj][kk] == 1) {
              drop += 1;
            }
            if (ii + drop < this.cellsArray.length) {
              // available data to copy down.
              this.cellsArray[ii][jj][kk] = this.cellsArray[ii + drop][jj][kk];
            }
            else
            {
              this.cellsArray[ii][jj][kk] = 0;
            }
          }
        }
      }

      // For the block entities, we take a different approach.
      // It's not easy to map from cell indices to blocks, so instead we iterate
      // through all blocks, and determine the correct action for each, based on
      // their cell indices.
      var sceneEl = document.querySelector('a-scene');
      var blockList = sceneEl.querySelectorAll('.block' + this.el.id);

      for (var blockIx = 0; blockIx < blockList.length; blockIx++) {

        var position = blockList[blockIx].object3D.position;
        const cellIndex = this.arenaPositionToCellIndices(position, true);

        if (cellsToDelete[cellIndex.y][cellIndex.x][cellIndex.z]) {
          // destroy the block.
          this.el.removeChild(blockList[blockIx]);
        }
        else {
          // We aren't destroying it, but maybe we need to drop it.
          var drop = 0;
          for (var ii = 0; ii < cellIndex.y; ii++) {
            drop += (cellsToDelete[ii][cellIndex.x][cellIndex.z]);
          }
          // drop the block by the correct number of spaces.
          position.y -= GRID_UNIT * drop;
        }
      }

      // Finally, we need to consider that all these movements may have
      // resulted in further lines being formed.
      // We could do this analysis now, but a better player experience is to
      // see how these new lines are formed and deleted, so we delay 500 msecs
      // before repeating the analysis.
      //
      // Set a variable, so this is triggered in the tick call.
      this.checkLinesTime = this.lastTickTime + 500;
    }
    else {
      // No lines removed.  No need to check again until the next shape falls.
      this.checkLinesTime = 0;
    }

    return (linesRemoved);
  },

  // Function to remove a layer (and remove associated blocks).
  // This is used when a layer is completed, and also to clear the arena
  // at the end of the game.
  removeLayer: function(layer) {
    // First our basic cell tracking.
    this.cellsArray.splice(layer, 1);

    // Now we iterate through all blocks in the scene, and for each, we:
    // - remove it if it's in the vanishing layer
    // - move it down if it's above the vanishing layer.
    // - do nothing if it's below.
    var sceneEl = document.querySelector('a-scene');
    var blockList = sceneEl.querySelectorAll('.block' + this.el.id);

    for (var blockIx = 0; blockIx < blockList.length; blockIx++) {

      // Since block objects are parented to the scene, we can
      // just read (and update) position directly,
      // no need to access "world position".

      var position = blockList[blockIx].object3D.position;
      // Now this is a child of arena, so posiiton is relative to arena.

      const cellIndex = this.arenaPositionToCellIndices(position, true);

      if (cellIndex.y == layer) {
        // In this layer.  Destroy the block.
        this.el.removeChild(blockList[blockIx]);
      }
      else if (cellIndex.y > layer) {
        // layer above - move down.
        position.y -= GRID_UNIT;        
        blockList[blockIx].emit("object3DUpdated");
      }
    }
  },

  tick: function(time, timeDelta) {

    this.lastTickTime = time;

    // This processing is only triggered if we are removing x or Z lines,
    // not layers.
    if ((this.checkLinesTime > 0) && (time > this.checkLinesTime))
    {
      var linesRemoved = this.removeAnyCompleteLines();

      if (linesRemoved > 0) {
        // We don't have a separate event for "lines removed"
        // just re-use the layers-removed event.
        this.el.emit("layers-removed", {count: linesRemoved});
      }
    }
  }
});

AFRAME.registerComponent('integration-tracker', {
  // This will be called after the entity has properly attached and loaded.
  // In this context, that means that the fallen block is integrated into the
  // scene.
  init: function () {
    var arena = document.querySelector(this.data.arena).components.arena;

    // Notify the arena the block fell into.  When all pending integrations
    // complete, it will continue with it's processing.
    console.log('Block creation completed for one block.');
    arena.blockIntegrated();
  }
});

/* General utility functions.  SHould work on a cleaner way to organize these */

function TETRISlogXYZ(text, pos, dp, debug = false) {

  var logtext = `${text} x: ${pos.x.toFixed(dp)}, y: ${pos.y.toFixed(dp)}, z: ${pos.z.toFixed(dp)}\n`
  if (debug) {
    console.log(logtext);
  }
  return (logtext);
}

function TETRISlogAllBlockPositions(element) {
  childrenArray = Array.from(element.childNodes);
  var worldPosition = new THREE.Vector3();

  for (ii = 0; ii < childrenArray.length; ii++) {
    // Need to get absolute position of each component block.
    childrenArray[ii].object3D.getWorldPosition(worldPosition);
    TETRISlogXYZ("Component Block at: ", worldPosition, 2, true);
  }
}

function TETRISlogQuat(text, quat, dp = 2, debug = false) {

  var logtext = `${text} w: ${quat.w.toFixed(dp)}, x: ${quat.x.toFixed(dp)}, y: ${quat.y.toFixed(dp)}, z: ${quat.z.toFixed(dp)}\n`

  if (debug) {
    var euler = new THREE.Euler(0,0,0)
    euler.setFromQuaternion(quat);
    logtext += `Equivalent Euler: x: ${euler.x.toFixed(dp)}, y: ${euler.y.toFixed(dp)}, z: ${euler.z.toFixed(dp)}\n`;
    console.log(logtext);
  }
  return (logtext);
}
