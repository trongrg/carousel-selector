(function($) {
  defaults = {
    childSelector: 'li',
    startingChild: null,
    startBearing: 0,
    clickToFocus: true,
    clickToFocusCallback: function() {},
    displayNumber: 5,
    duration: 600,
    minScale: 0.7,
    maxScale: 1.0
  };
  internalData = {
    animating: false,
    childInFocus: 0,
    lastAnimationStep: false
  };
  methods = {
    init: function(options, callback) {
      var settings;
      options = (typeof options === 'ojbect') ? options : {};
      callback = ($.isFunction(callback)) ? callback : function() {};
      callback  = ($.isFunction(options)) ? options : callback;
      settings = $.extend({}, defaults, options, internalData);

      return this.each(function(){
        var $this = $(this),
        childCount = $this.children(settings.childSelector).length,
        childHeight = $this.children(settings.childSelector).height(),
        startingChild = Math.floor(childCount/2),
        holderCSSBearing = ($this.css('position') !== 'static') ? $this.css('position') : 'relative';

        $this
        .css({
          padding: 0,
          position: holderCSSBearing,
          height: settings.displayNumber * childHeight + 'px'
        })
        .addClass('carousel-selector')
        .data('carousel-selector', $.extend({}, settings, {
          startingChild: startingChild,
          childInFocus: startingChild,
          childCount: childCount,
          bearing: 0
        }))
        .children(settings.childSelector)
        .each(function(i) {
          $(this)
          .bind('click.carousel-selector', function() {
            methods.stopAnimation.apply($(this));
            if (!$this.data('carousel-selector').animating) {
              methods.animateToBearing.apply($this, [$(this).data('carousel-selector').relativePos, $this.data('carousel-selector').clickToFocusCallback]);
            }
            return false;
          });
        });

        methods.initChildren.apply($this, [callback]);
      });
    },

    initChildren: function(callback) {
      var $this = $(this),
      data = $this.data('carousel-selector');
      callback = callback || function() {};

      $this.children(data.childSelector).each(function(i) {
        var $child = $(this),
        start = $child.data('carousel-selector-start-data');
        if (!start) {
          start = {
            width: $child.width(),
            height: $child.height(),
            fontSize: parseInt($child.css('font-size'), 10)
          };
          $child.data('carousel-selector-start-data', start)
        }

        $child
        .data('carousel-selector', {
          startWidth: start.width,
          startHeight: start.height,
          startFontSize: start.fontSize,
          childNumber: i,
          currentScale: 1,
          relativePos: i - data.childInFocus,
          parent: $this
        })
        .addClass('carousel-selector-item')
        .css({
          position: 'absolute',
          top: (-2*start.width) + 'px',
        });

      });

      methods.updateChildren.apply($this);

      $this.trigger('ready');
      callback.apply($this);
      return $this;
    },

    updateChildren: function() {
      return this
      .each(function() {
        var $this = $(this),
        data = $this.data('carousel-selector'),
        inFocus = data.childInFocus,
        info = {
          bearing: data.bearing,
          stage: {
            width: $this.width(),
            height: $this.height()
          },
          animating: data.animating,
          inFocus: data.childInFocus
        };

        info.midStage = {
          width: info.stage.width / 2,
          height: info.stage.height / 2
        };

        info.scale = {
          min: data.minScale,
          max: data.maxScale,
          diff: data.maxScale - data.minScale
        };

        $this.children(data.childSelector)
        .each(function(i) {
          if (methods.updateChild.apply($this, [$(this), info, i, function() { $(this).trigger('ready');}])
              && (!info.animating || data.lastAnimationStep)) {
                inFocus = i;
                $(this).addClass('carousel-selector-in-focus');
              } else {
                $(this).removeClass('carousel-selector-in-focus');
              }
        });

        if (inFocus != info.inFocus) {
          data.childInFocus = inFocus;
          $this.children(data.childSelector)
          .eq(inFocus)
          .trigger('focus');
        }

        $this.trigger('childrenUpdated');
      });
    },

    updateChild: function(childElement, info, childPos, callback) {
      var factors,
      $this = this,
      $child = $(childElement),
      data = $child.data('carousel-selector'),
      pdata = $this.data('carousel-selector'),
      callback = callback || function() {};

      relativePos = methods.adjustRelativePosition.apply(null, [data.relativePos - pdata.bearing, pdata]);
      if (!methods.isDisplayed.apply(null, [relativePos, pdata])){
        return;
      }
      factors = {}
      if (relativePos <= -1 || relativePos >= 1) {
        factors.scale = info.scale.min;
      } else {
        factors.scale = Math.cos(relativePos*Math.PI/2) * info.scale.diff + info.scale.min;
      }
      factors.width = (factors.scale * data.startWidth).toFixed(4);
      factors.height = (factors.scale * data.startHeight).toFixed(4);
      factors.left = (1 - factors.scale) / 2 * data.startWidth;
      factors.top = info.midStage.height + (relativePos - 1/2) * data.startHeight;
      if (relativePos > 0)
        factors.top += (1 - factors.scale) * data.startHeight;

      $child
      .css({
        left: factors.left + 'px',
        top: factors.top + 'px',
        width: factors.width + 'px',
        height: factors.height + 'px',
        fontSize: (factors.scale * data.startFontSize).toFixed(2) + 'px'
      });
      $child.find('img').css({width: factors.width + 'px', height: factors.height + 'px'});

      data.currentScale = factors.scale;
      $child.data('carousel-selector', data);

      $child.trigger('reposition');
      callback.apply($this);
      return false;
    },

    stopAnimation: function() {
      return this
      .each(function() {
        $(this).data('carousel-selector').stopAnimation = true;
      });
    },

    animateToBearing: function(bearing, duration, passedData, callback) {
      var now = (new Date()).getTime();

      callback = callback || function() {};

      if ($.isFunction(passedData)) {
        callback = passedData;
        passedData = null;
      } else if ($.isFunction(duration)) {
        callback = duration;
        duration = null;
      }

      this
      .each(function() {
        var timer, newBearing,
        $this = $(this),
        data = $this.data('carousel-selector'),
        thisDuration = (!duration) ? data.duration : duration,
        thisEasingType = 'swing';

        if (!passedData) {
          passedData = {
            timerStart: now,
            start: data.bearing,
            totalTime: thisDuration
          };
        }

        timer = now - passedData.timerStart;

        if (data.stopAnimation) {
          methods.allowAnimation.apply($this);
          data.animating = false;
          return;
        }

        if (timer < thisDuration) {
          if (!data.animating) {
            $this.trigger('animationStart');
          }

          data.animating = true;

          newBearing = $.easing[thisEasingType]((timer / passedData.totalTime), timer, passedData.start, bearing - passedData.start, passedData.totalTime);
          console.log(newBearing);

          if (methods.compareVersions.apply(null, [$().jquery, '1.7.2']) >= 0 && !($.easing['easeOutBack'])) {
            newBearing = passedData.start + ((bearing - passedData.start) * newBearing);
          }

          methods.setBearing.apply($this, [newBearing, function() {
            setTimeout(function() {
              methods.animateToBearing.apply($this, [bearing, thisDuration, passedData, callback]);
            }, 0);
          }]);

        } else {
          data.lastAnimationStep = true;

          methods.setBearing.apply($this, [bearing, function() {
            $this.trigger('animationEnd');
            }]);
            //update bearing, child in focus
            $this.children(data.childSelector).each(function(){
              $child = $(this);
              cdata = $child.data('carousel-selector');
              cdata.relativePos = methods.adjustRelativePosition.apply(null, [cdata.relativePos - bearing, data]);
            });
            data.childInFocus += bearing;
            data.bearing = 0;
            data.animating = false;
            data.lastAnimationStep = false;

            callback.apply($this);
        }
      });

      return this;
    },

    setBearing: function(bearing, callback) {
      callback = callback || function() {};

      this
      .each(function() {
        var $this = $(this),
        data = $this.data('carousel-selector');

        // set bearing
        data.bearing = bearing;
        $this.trigger('bearingSet');
        methods.updateChildren.apply($this);
      });

      // call callback if one was given
      callback.apply(this);
      return this;
    },

    compareVersions: function(baseVersion, compareVersion) {
      var i,
      base = baseVersion.split(/\./i),
      compare = compareVersion.split(/\./i),
      maxVersionSegmentLength = (base.length > compare.length) ? base.length : compare.length;

      for (i = 0; i <= maxVersionSegmentLength; i++) {
        if (base[i] && !compare[i] && parseInt(base[i], 10) !== 0) {
          // base is higher
          return 1;
        } else if (compare[i] && !base[i] && parseInt(compare[i], 10) !== 0) {
          // compare is higher
          return -1;
        } else if (base[i] === compare[i]) {
          // these are the same, next
          continue;
        }

        if (base[i] && compare[i]) {
          if (parseInt(base[i], 10) > parseInt(compare[i], 10)) {
            // base is higher
            return 1;
          } else {
            // compare is higher
            return -1;
          }
        }
      }

      // nothing was triggered, versions are the same
      return 0;
    },

    scroll: function(step){
      methods.animateToBearing.apply(this, [step]);
    },

    isDisplayed: function(relativePos, data) {
      return (relativePos > (-1 - data.displayNumber/2) && relativePos < (1 + data.displayNumber/2));
    },
    adjustRelativePosition: function(relativePos, data) {
      if (relativePos < -data.childCount / 2)
        return relativePos + data.childCount;
      else if (relativePos > data.childCount / 2)
        return relativePos - data.childCount;
      else
        return relativePos;
    }
  };
  $.fn.carouselSelector = function(arguments) {
    return methods.init.apply(this, arguments);
  };
  $.fn.carouselScroll = function(arguments) {
    return methods.scroll.apply(this, [arguments]);
  };
})(jQuery)
