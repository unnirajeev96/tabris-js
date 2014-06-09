/*global Tabris: false */

describe( "Tabris", function() {

  var calls = [];

  var nativeBridge = {
    create : function() {
      calls.push( { op: 'create',
                    id: arguments[0],
                    type: arguments[1],
                    properties: arguments[2] } );
    },
    set : function() {
      calls.push( { op: 'set',
                    id: arguments[0],
                    properties: arguments[1] } );
    },
    call : function() {
      calls.push( { op: 'call',
                    id: arguments[0],
                    method: arguments[1],
                    parameters: arguments[2] } );
    },
    listen : function() {
      calls.push( { op: 'listen',
                    id: arguments[0],
                    event: arguments[1],
                    listen: arguments[2] } );
    },
    destroy : function() {
      calls.push( { op: 'destroy',
                    id: arguments[0] } );
    }
  };

  var resetCalls = function() {
    return calls.splice( 0, calls.length );
  };

  var getCreateCalls = function() {
    return calls.filter( by({ op: 'create'}) );
  };

  var by = function( properties ) {
    return function( call ) {
      for( var key in properties ) {
        if( properties[key] != call[key] ) {
          return false;
        }
      }
      return true;
    };
  };

  beforeEach( function() {
    Tabris._start( nativeBridge );
    resetCalls();
  });

  describe( "_start", function() {

    it( "creates Display, Shell, and Tabris UI", function() {
      Tabris._start( nativeBridge );

      expect( getCreateCalls()[0].type ).toBe( "rwt.widgets.Display" );
      expect( getCreateCalls()[1].type ).toBe( "rwt.widgets.Shell" );
      expect( getCreateCalls()[2].type ).toBe( "tabris.UI" );
    });

    it( "created Shell is active, visible, and maximized", function() {
      Tabris._start( nativeBridge );

      var shellCreate = getCreateCalls().filter( by({ type: 'rwt.widgets.Shell' }) )[0];
      expect( shellCreate.properties.active ).toBe( true );
      expect( shellCreate.properties.visibility ).toBe( true );
      expect( shellCreate.properties.mode ).toBe( 'maximized' );
    });

    it( "Tabris UI refers to Shell", function() {
      Tabris._start( nativeBridge );

      var shellCreate = getCreateCalls().filter( by({ type: "rwt.widgets.Shell" }) )[0];
      var tabrisUiCreate = getCreateCalls().filter( by({ type: "tabris.UI" }) )[0];
      expect( tabrisUiCreate.properties.shell ).toBe( shellCreate.id );
    });

    it( "adds listeners for ShowPage and ShowPreviousPage events to Tabris UI", function() {
      Tabris._start( nativeBridge );

      var tabrisUiId = calls.filter( by({ op: 'create', type: 'tabris.UI' }) )[0].id;
      var listenCalls = calls.filter( by({ op: 'listen', id: tabrisUiId }) );
      expect( listenCalls.filter( by({ event: 'ShowPage' }) ).length ).toBe( 1 );
      expect( listenCalls.filter( by({ event: 'ShowPreviousPage' }) ).length ).toBe( 1 );
    });

    it( "can be called without a context", function() {
      Tabris._start.call( null, nativeBridge );
    });

    it( "fails if no native bridge is provided", function() {
      expect( function() {
        Tabris._start.call( null, null );
      } ).toThrow();
    });

  });

  describe( "_notify", function() {

    it( "notifies widget proxy", function() {
      var label = Tabris.create( "Label", {} );
      spyOn( label, "_notifyListeners" );

      Tabris._notify( label.id, "foo", { "bar": 23 } );

      expect( label._notifyListeners ).toHaveBeenCalledWith( "foo", [{ "bar": 23 }] );
    });

    it( "sliently ignores events for non-existing ids (does not crash)", function() {
      Tabris._notify( "no-id", "foo", [23, 42] );
    });

    it( "can be called without a context", function() {
      Tabris._notify.call( "no-id", "foo", [23, 42] );
    });

  });

  describe( "load", function() {

    it( "function is executed at start time", function() {
      var fn = jasmine.createSpy();

      Tabris.load( fn );
      Tabris._start( nativeBridge );

      expect( fn ).toHaveBeenCalled();
    });

    it( "nested load functions are executed at the end", function() {
      var log = [];

      Tabris.load( function() {
        log.push( "1" );
        Tabris.load( function() {
          log.push( "1a" );
        });
        Tabris.load( function() {
          log.push( "1b" );
        });
      });
      Tabris.load( function() {
        log.push( "2" );
      });
      Tabris._start( nativeBridge );

      expect( log ).toEqual([ "1", "2", "1a", "1b" ]);
    });

  });

  describe( "create", function() {

    it( "fails if tabris.js not yet started", function() {
      delete Tabris._nativeBridge;

      expect( function() {
        Tabris.create( "foo.bar", { foo: 23 } );
      } ).toThrow( "tabris.js not started" );
    } );

    it( "issues a create operation with type and properties", function() {
      Tabris.create( "foo.bar", { foo: 23 } );

      expect( calls.length ).toBe( 1 );
      expect( calls[0].op ).toBe( 'create' );
      expect( calls[0].type ).toBe( 'foo.bar' );
      expect( calls[0].properties ).toEqual( { foo: 23 } );
    } );

    it( "creates a non-empty widget id", function() {
      Tabris.create( "type", { foo: 23 } );

      var id = calls[0].id;
      expect( typeof id ).toBe( "string" );
      expect( id.length ).toBeGreaterThan( 0 );
    } );

    it( "creates different widget ids for subsequent calls", function() {
      Tabris.create( "type", { foo: 23 } );
      Tabris.create( "type", { foo: 23 } );

      expect( calls[0].id ).not.toEqual( calls[1].id );
    } );

    it( "returns a proxy object", function() {
      var result = Tabris.create( "type", { foo: 23 } );

      expect( result ).toBeDefined();
      expect( typeof result.set ).toBe( "function" );
    } );

    it( "translates widgets to ids in layoutData", function() {
      var label = Tabris.create( "Label", {} );

      Tabris.create( "custom.type", { layoutData: { left: 23, right: label, top: [label, 42] } } );

      var properties = calls.filter( by({ op: 'create', type: "custom.type" }) )[0].properties;
      expect( properties.layoutData ).toEqual( { left: 23, right: label.id, top: [label.id, 42] } );
    } );

    it( "accepts rwt types without prefix", function() {
      Tabris.create( "Label", {} );

      expect( calls[0].type ).toEqual( "rwt.widgets.Label" );
    } );

    it( "accepts prefixed types", function() {
      Tabris.create( "custom.Label", {} );

      expect( calls[0].type ).toEqual( "custom.Label" );
    } );

  } );

  describe( "createAction", function() {

    var handler;
    var actionCreate;

    beforeEach(function() {
      handler = jasmine.createSpy();
      Tabris.createAction( { title: "Foo", enabled: true }, handler );
      actionCreate = calls.filter( by({ op: 'create', type: 'tabris.Action' }) );
    });

    it( "creates an action", function() {
      expect( actionCreate.length ).toBe( 1 );
    });

    it( "created action's parent is set to Tabris.UI", function() {
      expect( actionCreate[0].properties.parent ).toEqual( Tabris._UI.id );
    });

    it( "properties are passed to created action", function() {
      expect( actionCreate[0].properties.title ).toEqual( "Foo" );
      expect( actionCreate[0].properties.enabled ).toBe( true );
    });

    it( "creates a listen operation", function() {
      var actionId = actionCreate[0].id;
      var listenCalls = calls.filter( by({ op: 'listen', id: actionId, event: 'Selection' }) );

      expect( listenCalls.length ).toBe( 1 );
    });

    it( "listen registers function that notifies listeners", function() {
      var actionId = actionCreate[0].id;
      Tabris._notify( actionId, "Selection", { "foo": 23 } );

      expect( handler ).toHaveBeenCalledWith( { "foo": 23 } );
    });

  } );

  describe( "createPage", function() {

    var getCompositeCreate = function() {
      return calls.filter( by( { op: 'create', type: 'rwt.widgets.Composite' }) )[0];
    };
    var getPageCreate = function() {
      return calls.filter( by( { op: 'create', type: 'tabris.Page' }) )[0];
    };

    it( "creates a Composite and a Page", function() {
      Tabris.createPage();

      expect( getCreateCalls().length ).toBe( 2 );
      expect( getCreateCalls()[0].type ).toBe( "rwt.widgets.Composite" );
      expect( getCreateCalls()[1].type ).toBe( "tabris.Page" );
    } );

    describe( "created Composite", function() {

      var createCall;

      beforeEach(function() {
        Tabris.createPage({ title: "title", image: "image", topLevel: true, background: "red" });
        createCall = getCreateCalls().filter( by( { type: 'rwt.widgets.Composite' }) )[0];
      });

      it( "does not inherit page properties", function() {
        expect( createCall.properties.title ).not.toBeDefined();
        expect( createCall.properties.image ).not.toBeDefined();
        expect( createCall.properties.topLevel ).not.toBeDefined();
      } );

      it( "has non-page properties", function() {
        expect( createCall.properties.background ).toEqual( "red" );
      } );

      it( "is full-size", function() {
        expect( createCall.properties.layoutData ).toEqual( { left: 0, right: 0, top: 0, bottom: 0 } );
      } );

      it( "parent is shell", function() {
        expect( createCall.properties.parent ).toEqual( Tabris._shell.id );
      } );

    } );

    describe( "created Page", function() {

      var createCall;

      beforeEach(function() {
        Tabris.createPage({ title: "title", image: "image", topLevel: true, background: "red" });
        createCall = getCreateCalls().filter( by( { type: 'tabris.Page' }) )[0];
      });

      it( "does not inherit non-page properties", function() {
        expect( createCall.properties.background ).not.toBeDefined();
      } );

      it( "has title, image and topLevel properties", function() {
        expect( createCall.properties.title ).toBe( "title" );
        expect( createCall.properties.image ).toBe( "image" );
        expect( createCall.properties.topLevel ).toBe( true );
      } );

      it( "control is set to composite", function() {
        expect( createCall.properties.control ).toBe( getCompositeCreate().id );
      } );

      it( "parent is set to Tabris.UI", function() {
        expect( createCall.properties.parent ).toBe( Tabris._UI.id );
      } );

    } );

    describe( "returned object", function() {

      it( "modifies composite", function() {
        var page = Tabris.createPage();

        page.set( "background", "red" );

        var setCalls = calls.filter( by({ op: 'set' }) );
        expect( setCalls.length ).toBeGreaterThan( 0 );
        expect( setCalls[0].properties.background ).toEqual( "red" );
      } );

      it( "supports open and close", function() {
        var page = Tabris.createPage();

        expect( typeof page.open ).toBe( 'function' );
        expect( typeof page.close ).toBe( 'function' );
        page.open();
      } );

      describe( "open", function() {

        it( "sets active page", function() {
          var page = Tabris.createPage();

          page.open();

          var call = calls.filter( by({ op: 'set', id: Tabris._UI.id  }) )[0];
          expect( call.properties.activePage ).toBe( getPageCreate().id );
        } );

      } );

      describe( "close", function() {

        it( "resets previous active page", function() {
          var page1 = Tabris.createPage();
          var page2 = Tabris.createPage();
          page1.open();
          var page1Id = getPageCreate().id;
          page2.open();
          resetCalls();

          page2.close();

          var call = calls.filter( by({ op: 'set', id: Tabris._UI.id  }) )[0];
          expect( call.properties.activePage ).toBe( page1Id ); // TODO add _pageId field in page
        } );

        it( "destroys composite and page", function() {
          var page = Tabris.createPage();
          page.open();

          page.close();

          expect( calls.filter( by({ op: 'destroy', id: getPageCreate().id }) ).length ).toBe( 1 );
          expect( calls.filter( by({ op: 'destroy', id: getCompositeCreate().id }) ).length ).toBe( 1 );
        } );

      } );

    } );

  } );

  describe( "set", function() {

    it( "translates widgets to ids in layoutData", function() {
      var label = Tabris.create( "Label", {} );
      label.set( "layoutData", { left: 23, right: label, top: [label, 42] } );

      var call = calls.filter( by({ op: 'set' }) )[0];
      expect( call.properties.layoutData ).toEqual( { left: 23, right: label.id, top: [label.id, 42] } );
    } );

  } );

  describe( "call", function() {

    it( "issues call operation", function() {
      var label = Tabris.create( "type", { foo: 23 } );
      label.call( "method", { foo: 23 } );

      expect( calls[1].op ).toEqual( 'call' );
      expect( calls[1].method ).toEqual( 'method' );
      expect( calls[1].parameters ).toEqual( { foo: 23 } );
    } );

  } );

  describe( "on", function() {

    var label;
    var listener;

    beforeEach( function() {
      label = Tabris.create( "Label", {} );
      listener = jasmine.createSpy( "listener" );
      resetCalls();
    } );

    it( "issues a listen (true) operation for first listener", function() {
      label.on( "foo", listener );

      expect( calls[0].op ).toEqual( "listen" );
      expect( calls[0].event ).toEqual( "foo" );
      expect( calls[0].listen ).toEqual( true );
    } );

    it( "issues a listen operation for another listener for another event", function() {
      label.on( "foo", listener );
      label.on( "bar", listener );

      expect( calls[1].op ).toEqual( "listen" );
      expect( calls[1].event ).toEqual( "bar" );
    } );

    it( "does not issue a listen operation for subsequent listeners for the same event", function() {
      label.on( "foo", listener );
      label.on( "foo", listener );

      expect( calls.length ).toBe( 1 );
    } );

  } );

  describe( "off", function() {

    var label;
    var listener;

    beforeEach( function() {
      label = Tabris.create( "Label", {} );
      listener = jasmine.createSpy( "listener" );
      label.on( "foo", listener );
      resetCalls();
    } );

    it( "issues a listen (false) operation for last listener removed", function() {
      label.off( "foo", listener );

      expect( calls[0].op ).toEqual( "listen" );
      expect( calls[0].event ).toEqual( "foo" );
      expect( calls[0].listen ).toBe( false );
    } );

    it( "does not issue a listen operation when there are other listeners for the same event", function() {
      label.on( "foo", listener );
      label.off( "foo", listener );

      expect( calls.length ).toBe( 0 );
    } );

  } );

  describe( "destroy", function() {

    it( "issues destroy operation", function() {
      var label = Tabris.create( "type", { foo: 23 } );

      label.destroy();

      var destroyCalls = calls.filter( by({ op: 'destroy', id: calls[0].id }) );
      expect( destroyCalls.length ).toBe( 1 );
    } );

    it( "notifies dispose listeners", function() {
      var label = Tabris.create( "type", { foo: 23 } );
      var listener = jasmine.createSpy();
      label.on( "Dispose", listener );

      label.destroy();

      expect( listener ).toHaveBeenCalled();
    } );

  } );

  describe( "listener management", function() {

    var label;
    var listener;

    beforeEach( function() {
      label = Tabris.create( "Label", {} );
      listener = jasmine.createSpy( "listener" );
    } );

    it( "added listener will be notified", function() {
      label._addListener( "foo", listener );
      label._notifyListeners( "foo", ["bar", 23] );

      expect( listener ).toHaveBeenCalledWith( "bar", 23 );
    } );

    it( "listeners added twice will be notified twice", function() {
      label._addListener( "foo", listener );
      label._addListener( "foo", listener );
      label._notifyListeners( "foo", ["bar", 23] );

      expect( listener.calls.length ).toBe( 2 );
    } );

    it( "removed listeners will not be notfied anymore", function() {
      label._addListener( "foo", listener );
      label._removeListener( "foo", listener );
      label._notifyListeners( "foo", [] );

      expect( listener ).not.toHaveBeenCalled();
    } );

  } );

} );
