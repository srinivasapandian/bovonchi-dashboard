import { combineReducers } from 'redux';
import { productCatalogReducer } from './productCatalog/productCatalogReducer';
import { serverInfoReducer } from './serverInfo/serverInfoIndex';
import { RESET_REPORTS_DATA } from './globalActions';

const appReducer = combineReducers({
  productCatalog: productCatalogReducer,
  serverInfo: serverInfoReducer,
});

/**
 * On logout we drop every cached slice so a different account never sees the
 * previous session's catalog. Setting a slice to `undefined` makes
 * combineReducers re-initialise it from its own initialState.
 */
const rootReducer = (state: any, action: any) => {
  if (action.type === RESET_REPORTS_DATA && state) {
    state = { ...state, productCatalog: undefined, serverInfo: undefined };
  }
  return appReducer(state, action);
};

export { rootReducer };
export type RootState = ReturnType<typeof appReducer>;
