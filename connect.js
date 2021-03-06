"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var react_1 = require('react');
var isObject = require('lodash.isobject');
var isEqual = require('lodash.isequal');
var invariant = require('invariant');
var assign = require('object-assign');
var hoistNonReactStatics = require('hoist-non-react-statics');
var react_redux_1 = require('react-redux');
var apollo_client_1 = require('apollo-client');
;
;
;
var defaultMapQueriesToProps = function (opts) { return ({}); };
var defaultMapMutationsToProps = function (opts) { return ({}); };
var defaultQueryData = {
    loading: true,
    errors: null,
};
var defaultMutationData = assign({}, defaultQueryData);
defaultMutationData.loading = false;
function getDisplayName(WrappedComponent) {
    return WrappedComponent.displayName || WrappedComponent.name || 'Component';
}
var nextVersion = 0;
function connect(opts) {
    if (!opts) {
        opts = {};
    }
    var mapQueriesToProps = opts.mapQueriesToProps, mapMutationsToProps = opts.mapMutationsToProps;
    var mapQueries;
    if (mapQueriesToProps) {
        mapQueries = true;
    }
    delete opts.mapQueriesToProps;
    delete opts.mapMutationsToProps;
    mapQueriesToProps = mapQueriesToProps ? mapQueriesToProps : defaultMapQueriesToProps;
    mapMutationsToProps = mapMutationsToProps ? mapMutationsToProps : defaultMapMutationsToProps;
    var version = nextVersion++;
    return function wrapWithApolloComponent(WrappedComponent) {
        var apolloConnectDisplayName = "Apollo(" + getDisplayName(WrappedComponent) + ")";
        var ApolloConnect = (function (_super) {
            __extends(ApolloConnect, _super);
            function ApolloConnect(props, context) {
                _super.call(this, props, context);
                this.childRenderError = null;
                this.isRenderingError = false;
                this.version = version;
                this.store = props.store || context.store;
                this.client = props.client || context.client;
                invariant(!!this.client, "Could not find \"client\" in either the context or " +
                    ("props of \"" + apolloConnectDisplayName + "\". ") +
                    "Either wrap the root component in a <Provider>, " +
                    ("or explicitly pass \"client\" as a prop to \"" + apolloConnectDisplayName + "\"."));
                var storeState = this.store.getState();
                this.state = assign({}, storeState);
                this.previousState = storeState;
                this.data = {};
                this.mutations = {};
                this.queryObservables = {};
                this.querySubscriptions = {};
            }
            ApolloConnect.prototype.componentWillMount = function () {
                var props = this.props;
                this.subscribeToAllQueries(props);
                this.createAllMutationHandles(props);
                this.bindStoreUpdates();
            };
            ApolloConnect.prototype.componentDidMount = function () {
                this.hasMounted = true;
            };
            ApolloConnect.prototype.componentWillReceiveProps = function (nextProps) {
                if (!isEqual(this.props, nextProps)) {
                    this.haveOwnPropsChanged = true;
                    this.createAllMutationHandles(nextProps);
                    this.subscribeToAllQueries(nextProps);
                }
            };
            ApolloConnect.prototype.shouldComponentUpdate = function (nextProps, nextState) {
                return this.haveOwnPropsChanged ||
                    this.hasOwnStateChanged ||
                    this.hasQueryDataChanged ||
                    this.hasMutationDataChanged;
            };
            ApolloConnect.prototype.componentWillUnmount = function () {
                this.unsubcribeAllQueries();
                if (this.unsubscribeFromStore) {
                    this.unsubscribeFromStore();
                    this.unsubscribeFromStore = null;
                }
                this.hasMounted = false;
            };
            ApolloConnect.prototype.forceRenderChildren = function () {
                var isRenderingError = this.isRenderingError;
                try {
                    this.setState(this.store.getState());
                }
                catch (e) {
                    this.childRenderError = e;
                    this.isRenderingError = true;
                    if (!isRenderingError) {
                        this.forceUpdate();
                    }
                }
            };
            ApolloConnect.prototype.bindStoreUpdates = function () {
                var _this = this;
                var store = this.store;
                var reduxRootKey = this.client.reduxRootKey;
                this.unsubscribeFromStore = store.subscribe(function () {
                    var props = _this.props;
                    var newState = assign({}, store.getState());
                    var oldState = assign({}, _this.previousState);
                    delete newState[reduxRootKey];
                    delete oldState[reduxRootKey];
                    if (!isEqual(oldState, newState)) {
                        _this.previousState = newState;
                        _this.hasOwnStateChanged = _this.subscribeToAllQueries(props);
                        _this.createAllMutationHandles(props);
                    }
                });
            };
            ApolloConnect.prototype.subscribeToAllQueries = function (props) {
                var _a = this.client, watchQuery = _a.watchQuery, reduxRootKey = _a.reduxRootKey;
                var store = this.store;
                var queryOptions = mapQueriesToProps({
                    state: store.getState(),
                    ownProps: props,
                });
                var oldQueries = assign({}, this.previousQueries);
                this.previousQueries = assign({}, queryOptions);
                if (isEqual(oldQueries, queryOptions)) {
                    return false;
                }
                else if (oldQueries) {
                    this.unsubcribeAllQueries();
                }
                if (isObject(queryOptions) && Object.keys(queryOptions).length) {
                    for (var key in queryOptions) {
                        if (!queryOptions.hasOwnProperty(key)) {
                            continue;
                        }
                        var _b = queryOptions[key], query = _b.query, variables = _b.variables, forceFetch = _b.forceFetch;
                        var observableQuery = watchQuery(queryOptions[key]);
                        console.info(observableQuery);
                        var queryData = defaultQueryData;
                        if (!forceFetch) {
                            try {
                                var result = apollo_client_1.readQueryFromStore({
                                    store: store.getState()[reduxRootKey].data,
                                    query: query,
                                    variables: variables,
                                });
                                queryData = assign({
                                    errors: null,
                                    loading: false,
                                }, result);
                            }
                            catch (e) { }
                        }
                        this.data[key] = queryData;
                        this.handleQueryData(observableQuery, key);
                    }
                }
                return true;
            };
            ApolloConnect.prototype.unsubcribeAllQueries = function () {
                if (this.querySubscriptions) {
                    for (var key in this.querySubscriptions) {
                        if (!this.querySubscriptions.hasOwnProperty(key)) {
                            continue;
                        }
                        this.querySubscriptions[key].unsubscribe();
                    }
                }
            };
            ApolloConnect.prototype.handleQueryData = function (observableQuery, key) {
                var _this = this;
                var refetch, startPolling, stopPolling, fetchMore, updateQuery, oldData = {};
                var createBoundRefetch = function (dataKey, refetchMethod) {
                    return function () {
                        var args = [];
                        for (var _i = 0; _i < arguments.length; _i++) {
                            args[_i - 0] = arguments[_i];
                        }
                        _this.data[dataKey] = assign(_this.data[dataKey], {
                            loading: true,
                            refetch: refetch,
                        });
                        _this.hasQueryDataChanged = true;
                        if (_this.hasMounted) {
                            _this.forceRenderChildren();
                        }
                        var previousRequest = assign({}, oldData);
                        return refetchMethod.apply(void 0, args)
                            .then(function (result) {
                            var data = result.data;
                            if (isEqual(data, previousRequest) || _this.data[dataKey].errors) {
                                _this.data[dataKey] = assign(_this.data[dataKey], {
                                    loading: false,
                                    errors: null,
                                });
                                _this.hasQueryDataChanged = true;
                                if (_this.hasMounted) {
                                    _this.forceRenderChildren();
                                }
                            }
                            previousRequest = assign({}, data);
                            return result;
                        });
                    };
                };
                var createBoundFetchMore = function (dataKey, fetchMoreMethod) {
                    return function () {
                        var args = [];
                        for (var _i = 0; _i < arguments.length; _i++) {
                            args[_i - 0] = arguments[_i];
                        }
                        _this.data[dataKey] = assign(_this.data[dataKey], {
                            loading: true,
                            fetchMore: fetchMore,
                        });
                        _this.hasQueryDataChanged = true;
                        if (_this.hasMounted) {
                            _this.forceRenderChildren();
                        }
                        return fetchMoreMethod.apply(void 0, args);
                    };
                };
                var forceRender = function (_a) {
                    var errors = _a.errors, _b = _a.data, data = _b === void 0 ? oldData : _b;
                    var resultKeyConflict = ('errors' in data ||
                        'loading' in data ||
                        'refetch' in data ||
                        'startPolling' in data ||
                        'stopPolling' in data ||
                        'fetchMore' in data ||
                        'updateQuery' in data);
                    invariant(!resultKeyConflict, ("the result of the '" + key + "' query contains keys that ") +
                        "conflict with the return object. 'errors', 'loading', " +
                        "'startPolling', 'stopPolling', 'refetch', and 'fetchMore' " +
                        "cannot be returned keys");
                    if (!isEqual(oldData, data) || errors || _this.data[key].loading) {
                        _this.hasQueryDataChanged = true;
                    }
                    oldData = assign({}, data);
                    _this.data[key] = assign({
                        loading: false,
                        errors: errors,
                        refetch: refetch,
                        startPolling: startPolling,
                        stopPolling: stopPolling,
                        fetchMore: fetchMore,
                        updateQuery: updateQuery,
                    }, data);
                    if (_this.hasMounted) {
                        _this.forceRenderChildren();
                    }
                };
                this.queryObservables[key] = observableQuery;
                this.querySubscriptions[key] = observableQuery.subscribe({
                    next: forceRender,
                    error: function (errors) { forceRender({ errors: errors }); },
                });
                refetch = createBoundRefetch(key, this.queryObservables[key].refetch ||
                    this.querySubscriptions[key].refetch);
                startPolling = this.queryObservables[key].startPolling ||
                    this.querySubscriptions[key].startPolling;
                stopPolling = this.queryObservables[key].stopPolling ||
                    this.querySubscriptions[key].stopPolling;
                updateQuery = this.queryObservables[key].updateQuery ||
                    this.querySubscriptions[key].updateQuery;
                fetchMore = createBoundFetchMore(key, this.queryObservables[key].fetchMore);
                this.data[key] = assign(this.data[key], {
                    refetch: refetch,
                    startPolling: startPolling,
                    stopPolling: stopPolling,
                    fetchMore: fetchMore,
                    updateQuery: updateQuery,
                });
            };
            ApolloConnect.prototype.createAllMutationHandles = function (props) {
                var mutations = mapMutationsToProps({
                    ownProps: props,
                    state: this.store.getState(),
                });
                if (isObject(mutations) && Object.keys(mutations).length) {
                    for (var key in mutations) {
                        if (!mutations.hasOwnProperty(key)) {
                            continue;
                        }
                        var handle = this.createMutationHandle(key, mutations[key]);
                        this.data[key] = defaultMutationData;
                        this.mutations[key] = handle;
                    }
                }
            };
            ApolloConnect.prototype.createMutationHandle = function (key, method) {
                var _this = this;
                var mutate = this.client.mutate;
                var store = this.store;
                var forceRender = function (_a) {
                    var errors = _a.errors, _b = _a.data, data = _b === void 0 ? {} : _b;
                    var resultKeyConflict = ('errors' in data ||
                        'loading' in data ||
                        'fetchMore' in data ||
                        'refetch' in data);
                    invariant(!resultKeyConflict, ("the result of the '" + key + "' mutation contains keys that ") +
                        "conflict with the return object. 'errors', 'loading', " +
                        "fetchMore' and 'refetch' cannot be " +
                        "returned keys");
                    _this.data[key] = assign({
                        loading: false,
                        errors: errors,
                    }, data);
                    _this.hasMutationDataChanged = true;
                    if (_this.hasMounted) {
                        _this.forceRenderChildren();
                    }
                    return {
                        errors: errors,
                        data: data,
                    };
                };
                return function () {
                    var args = [];
                    for (var _i = 0; _i < arguments.length; _i++) {
                        args[_i - 0] = arguments[_i];
                    }
                    var stateAndProps = {
                        state: store.getState(),
                        ownProps: _this.props,
                    };
                    args.push(stateAndProps);
                    var mutationOptions = method.apply(_this.client, args);
                    return new Promise(function (resolve, reject) {
                        _this.data[key] = assign(_this.data[key], {
                            loading: true,
                        });
                        _this.hasMutationDataChanged = true;
                        if (_this.hasMounted) {
                            _this.forceRenderChildren();
                        }
                        resolve();
                    })
                        .then(function () {
                        return mutate(mutationOptions);
                    })
                        .then(forceRender)
                        .catch(function (errors) { return forceRender({ errors: errors }); });
                };
            };
            ApolloConnect.prototype.render = function () {
                var _a = this, haveOwnPropsChanged = _a.haveOwnPropsChanged, hasOwnStateChanged = _a.hasOwnStateChanged, hasQueryDataChanged = _a.hasQueryDataChanged, hasMutationDataChanged = _a.hasMutationDataChanged, childRenderError = _a.childRenderError, renderedElement = _a.renderedElement, mutations = _a.mutations, props = _a.props, data = _a.data;
                this.childRenderError = null;
                if (childRenderError) {
                    throw childRenderError;
                }
                this.haveOwnPropsChanged = false;
                this.hasOwnStateChanged = false;
                this.hasQueryDataChanged = false;
                this.hasMutationDataChanged = false;
                var clientProps = {};
                if (Object.keys(mutations).length) {
                    clientProps.mutations = mutations;
                }
                var mergedPropsAndData = assign({}, props, clientProps, data);
                for (var key in this.client) {
                    if (!this.client.hasOwnProperty(key)) {
                        continue;
                    }
                    if (typeof this.client[key] === 'function' && !mergedPropsAndData[key]) {
                        mergedPropsAndData[key] = this.client[key];
                    }
                }
                if (!haveOwnPropsChanged &&
                    !hasOwnStateChanged &&
                    !hasQueryDataChanged &&
                    !hasMutationDataChanged &&
                    renderedElement) {
                    return renderedElement;
                }
                this.renderedElement = react_1.createElement(WrappedComponent, mergedPropsAndData);
                return this.renderedElement;
            };
            ApolloConnect.displayName = apolloConnectDisplayName;
            ApolloConnect.WrappedComponent = WrappedComponent;
            ApolloConnect.contextTypes = {
                store: react_1.PropTypes.object.isRequired,
                client: react_1.PropTypes.object.isRequired,
            };
            ApolloConnect.mapQueriesToProps = mapQueries ? mapQueriesToProps : false;
            ApolloConnect.opts = opts;
            return ApolloConnect;
        }(react_1.Component));
        hoistNonReactStatics(ApolloConnect, WrappedComponent);
        var mapStateToProps = opts.mapStateToProps, mapDispatchToProps = opts.mapDispatchToProps, mergeProps = opts.mergeProps, options = opts.options;
        return react_redux_1.connect(mapStateToProps, mapDispatchToProps, mergeProps, options)(ApolloConnect);
    };
}
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = connect;
;
//# sourceMappingURL=connect.js.map
