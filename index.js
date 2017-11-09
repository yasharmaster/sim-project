// queue to land
// number of docked or approaching planes
// change color of plane for modes
// make planes avoid planes
// adjustable settings
// add random wind factors

window.requestAnimFrame=function(){return window.requestAnimationFrame||window.webkitRequestAnimationFrame||window.mozRequestAnimationFrame||function(a){window.setTimeout(a,1E3/60)}}();

// Create empty window object
$ = {};

$.util = {

  // Genereate a random number which lies between min & max
  rand: function( min, max ) {
    return Math.random() * ( max - min ) + min;
  },

  // Genereate a random integer which lies between min & max
  randInt: function( min, max ) {
    return Math.floor( Math.random() * ( max - min + 1 ) ) + min;
  },

  // Normalize a value which between min & max to range 0 to 1
  norm: function( val, min, max ) {
	    return ( val - min ) / ( max - min );
	  },

  // Linear Interpolation of a normalized value to a given range
  lerp: function( norm, min, max ) {
    return ( max - min ) * norm + min;
  },

  // Map a value from one range to another
  map: function( val, sMin, sMax, dMin, dMax ) {
    return $.util.lerp( $.util.norm( val, sMin, sMax), dMin, dMax );
	},
  
  // Restrict a value to the given range
  clamp: function( val, min, max ) {
    return Math.min( Math.max( val, Math.min( min, max ) ), Math.max( min, max ) );
	},

  // Calcuate Euclidean Distance between two points
  distance: function( p1, p2 ) {
	    var dx = p1.x - p2.x,
		        dy = p1.y - p2.y;
    	return Math.sqrt( dx * dx + dy * dy );
  },

  // Calulate the angle made by the line joining the given two points
  angle: function( p1, p2 ) {
	    return Math.atan2( p1.y - p2.y, p1.x - p2.x );
  },

  // Check if value lies in the given range
  inRange: function( val, min, max ) {
	    return val >= Math.min( min, max ) && val <= Math.max( min, max );
  },

  // Check if the given point lies in the given rectangle
  pointInRect: function( x, y, rect ) {
    return $.util.inRange( x, rect.x, rect.x + rect.width ) &&
      $.util.inRange( y, rect.y, rect.y + rect.height );
  },

  // Check if the given point is in the given arc
  pointInArc: function( p, a ) {
    return distance( p, a ) <= a.radius;
  },

  // set properties to the object
  setProps: function( obj, props ) {
	    for( var k in props ) {
		      obj[ k ] = props[ k ];
	    }
  },

  // 
  multicurve: function( points, ctx ) {
    var p0, p1, midx, midy;
    ctx.moveTo(points[0].x, points[0].y);
    for(var i = 1; i < points.length - 2; i += 1) {
      p0 = points[i];
      p1 = points[i + 1];
      midx = (p0.x + p1.x) / 2;
      midy = (p0.y + p1.y) / 2;
      ctx.quadraticCurveTo(p0.x, p0.y, midx, midy);
    }
    p0 = points[points.length - 2];
    p1 = points[points.length - 1];
    ctx.quadraticCurveTo(p0.x, p0.y, p1.x, p1.y);
  }
};

// Initialize the simulation
$.init = function() {
  // setup the canvas
  $.c = document.createElement( 'canvas' );
  $.ctx = $.c.getContext( '2d' );
  document.body.appendChild( $.c );
  
  // collections
  $.ports = [];
  $.planes = [];  
  
  // events
  window.addEventListener( 'resize', $.reset, false );
  window.addEventListener( 'click', $.reset, false );
  $.reset();
  $.step();
};

$.reset = function() {
  // dimensions
  $.cw = $.c.width = window.innerWidth;
  $.ch = $.c.height = window.innerHeight;
  $.dimAvg = ( $.cw + $.ch ) / 2;
  
  // type / font
  $.ctx.textAlign = 'center';
  $.ctx.textBaseline = 'middle';
  $.ctx.font = '16px monospace';
  
  // options / settings
  $.opt = {};
  $.opt.portCount = 3;
  $.opt.planeCount = 15;
  $.opt.portSpacingDist = $.dimAvg / $.opt.portCount;
  $.opt.holdingDist = 5;
  $.opt.approachDist = 80;
  $.opt.planeDist = 20;  
  $.opt.pathSpacing = 15;
  $.opt.pathCount = 40;
  $.opt.avoidRadius = 30;
  $.opt.avoidMult = 0.025;
  
  // collections
  $.ports.length = 0;
  $.planes.length = 0;
 
  // delta
  $.lt = Date.now();
  $.dt = 1;
  $.et = 0;
  $.tick = 0;
  
  // setup ports
  for( var i = 0; i < $.opt.portCount; i++ ) {
    $.ports.push( new $.Port() );
  }
  
  // setup planes
  for( var i = 0; i < $.opt.planeCount; i++ ) {
    $.planes.push( new $.Plane() );
  }  
};

// Port Constructor
// Create a port at a random location in the canvas
$.Port = function() {
  this.x = $.util.rand( $.cw * 0.1, $.cw * 0.9 );
  this.y = $.util.rand( $.ch * 0.1, $.ch * 0.9 );
  while( !this.validSpacing() ) {
    this.x = $.util.rand( $.cw * 0.1, $.cw * 0.9 );
    this.y = $.util.rand( $.ch * 0.1, $.ch * 0.9 );
  }
};

// Check if this port is separated by all others by atleast the specified port spacing distance
$.Port.prototype.validSpacing = function() {
  var spaced = true,
      i = $.ports.length;
  while( i-- ) {
    var otherPort = $.ports[ i ];
    if( $.util.distance( otherPort, this ) < $.opt.portSpacingDist ) {
      spaced = false;
      break;
    }
  }
  return spaced;
};

// Update the count of the approaching planes for the port
$.Port.prototype.update = function( i ) {
  var j = $.planes.length;
  this.approachingCount = 0;
  while( j-- ) {
    var plane = $.planes[ j ];
    if( plane.destIndex == i && plane.approaching ) {
      this.approachingCount++;
    }
  }
};

// Draw Port
$.Port.prototype.render = function( i ) {
  // Draw a circle surrounding the port
  $.ctx.beginPath();  
  $.ctx.arc( this.x, this.y, 3 + ( this.approachingCount + 5 ), 0, Math.PI * 2 );
  $.ctx.fillStyle = 'hsla(120, 90%, 80%, ' + ( 0.35 + Math.sin( $.et / 20 ) * 0.2 ) + ')';
  $.ctx.fill();  
 
  // Write approaching count to the airport
  $.ctx.fillStyle = '#fff';
  $.ctx.fillText( this.approachingCount, this.x, this.y - 30 );
};

// Plane Constructor
$.Plane = function( opt ) {
  // Randomly allocate origin index
  this.originIndex = $.util.randInt( 0, $.ports.length - 1 );
  // Origin port of the plane
  this.origin = $.ports[ this.originIndex ];
  this.path = [];
  this.x = this.origin.x;
  this.y = this.origin.y;
  // Randomly allocate initial velocity
  this.vx = $.util.rand( -0.35, 0.35 );
  this.vy = $.util.rand( -0.35, 0.35 );
  this.vmax = 1;
  this.accel = 0.01;
  this.decel = 0.96;
  this.angle = 0;
  this.approaching = false;
  this.holding = false;
  this.setDest();  
};

// Set destination of the plane randomly
$.Plane.prototype.setDest = function() {
  if( this.destIndex != undefined ) {
    this.originIndex = this.destIndex;
    this.origin = $.ports[ this.originIndex ];
  }
  this.destIndex = $.util.randInt( 0, $.ports.length - 1 );
  while( this.destIndex == this.originIndex ) {
    this.destIndex = $.util.randInt( 0, $.ports.length - 1 );    
  }
  this.dest = $.ports[ this.destIndex ];
  this.approaching = false;
  this.holding = false;
}

// Update plane status
$.Plane.prototype.update = function( i ) {
  this.ox = this.x;
  this.oy = this.y;
  if( $.tick % $.opt.pathSpacing == 0 ) {
    this.path.push( { x: this.x, y: this.y } );    
  }

  // If paths are more then specified then remove one
  if( this.path.length > $.opt.pathCount ) {
    this.path.shift();
  }
  
  // Calculate angle and speed
  this.angle = $.util.angle( this.dest, this );
  this.speed = ( Math.abs( this.vx ) + Math.abs( this.vy ) ) / 2;
  
  // If plane is moving outside canvas, bring it back
  if( !$.util.pointInRect( this.x, this.y, { x: 0, y: 0, width: $.cw, height: $.ch } ) ) {
    this.vx *= this.decel;
    this.vy *= this.decel;    
  }
  
  // Reduce the speed if plane is getting closer to the port
  if( this.speed > 0.1 ) {
    if( $.util.distance( this.dest, this ) < $.opt.approachDist ) {
      this.vx *= this.decel;
      this.vy *= this.decel;    
      this.approaching = true;
   }
  }
  
  // If plane reaches at the port, hold and randomly create another destination
  if( $.util.distance( this.dest, this ) < $.opt.holdingDist ) {
    this.holding = true;
    this.setDest();
  }
  
  // plane checks
  // var j = i;
  // while( j-- ) {
  //   var otherPlane = $.planes[ j ];
  //   if( $.util.distance( otherPlane, this ) < $.opt.avoidRadius ) {
  //     var angle = $.util.angle( otherPlane, this );
  //     var changer = ( ( Math.abs( this.vx ) + Math.abs( this.vy ) + Math.abs( otherPlane.vx ) + Math.abs( otherPlane.vy ) ) / 4 ) * $.opt.avoidMult;
  //     this.vx -= Math.cos( angle ) * changer;
  //     this.vy -= Math.sin( angle ) * changer;
  //     otherPlane.vx += Math.cos( angle ) * changer;
  //     otherPlane.vy += Math.sin( angle ) * changer;
  //   }
  // }
  
  // Accelerate the plane
  this.vx += Math.cos( this.angle ) * this.accel;
  this.vy += Math.sin( this.angle ) * this.accel;
  if( this.speed > this.vmax ) {
    this.vx *= this.decel;
    this.vy *= this.decel;
  }
  
  // Move the plane forward
  this.x += this.vx * $.dt;
  this.y += this.vy * $.dt;
};

// Draw the plane and its path
$.Plane.prototype.render = function( i ) {  
  // Different color when the plane is approaching
  if( this.approaching ) {
    $.ctx.strokeStyle = 'hsla(0, 80%, 50%, 1)';
  } else {
    $.ctx.strokeStyle = 'hsla(180, 80%, 50%, 1)'; 
  }

  // Draw the path to the plane
  $.ctx.beginPath();
  $.ctx.moveTo( this.x, this.y );
  var angle = $.util.angle( { x: this.ox, y: this.oy }, this );
  $.ctx.lineWidth = 2;
  $.ctx.lineTo( 
    this.x - Math.cos( angle ) * ( 3 + this.speed * 2 ), 
    this.y - Math.sin( angle ) * ( 3 + this.speed * 2 ) 
  );
  $.ctx.stroke();
  
  var pathLength = this.path.length;
  if( pathLength > 1) {
    $.ctx.strokeStyle = 'hsla(0, 0%, 100%, 0.15)';
    $.ctx.lineWidth = 1;
    $.ctx.beginPath();
    
    if( pathLength >= $.opt.pathCount ) {
      var angle = $.util.angle( this.path[ 1 ], this.path[ 0 ] ),
          dx = this.path[ 0 ].x - this.path[ 1 ].x,
          dy = this.path[ 0 ].y - this.path[ 1 ].y,
          dist = Math.sqrt( dx * dx + dy * dy ),
          x = this.path[ 0 ].x + Math.cos( angle ) * ( dist * ( ( $.tick % $.opt.pathSpacing ) / $.opt.pathSpacing ) ),
          y = this.path[ 0 ].y + Math.sin( angle ) * ( dist * ( ( $.tick % $.opt.pathSpacing ) / $.opt.pathSpacing ) );
    } else {
      var x = this.path[ 0 ].x,
          y = this.path[ 0 ].y
    }
        
    $.ctx.moveTo( x, y );
    for( var i = 1; i < pathLength; i++ ) {
      var point = this.path[ i ];
      $.ctx.lineTo( point.x, point.y );  
    }
    $.ctx.lineTo( this.x, this.y );
    $.ctx.stroke();
  }
};

$.step = function() {
  requestAnimFrame( $.step );
  
  // clear
  // Display the destination image out of the source image. 
  // Show only the part of the destination image that is OUTSIDE the source image, 
  // and keep the source image is transparent
  $.ctx.globalCompositeOperation = 'destination-out';
  $.ctx.fillStyle = 'hsla(0, 0%, 0%, 1)';
  $.ctx.fillRect( 0, 0, $.cw, $.ch );
  $.ctx.globalCompositeOperation = 'lighter';
  
  // collections
  var i;
  i = $.ports.length; while( i-- ) { $.ports[ i ].update( i ) }
  i = $.planes.length; while( i-- ) { $.planes[ i ].update( i ) }
  i = $.ports.length; while( i-- ) { $.ports[ i ].render( i ) }
  i = $.planes.length; while( i-- ) { $.planes[ i ].render( i ) }
  
  // delta
  var now = Date.now();
	$.dt = $.util.clamp( ( now - $.lt ) / ( 1000 / 60 ), 0.001, 10 );
	$.lt = now;
  $.et += $.dt;
  $.tick++;
};

$.init();