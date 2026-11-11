import { all, fork } from 'redux-saga/effects';
import { productCatalogSaga } from './productCatalog/productCatalogSaga';
import { serverInfoSaga } from './serverInfo/serverInfoIndex';

export default function* rootSaga() {
  yield all([fork(productCatalogSaga), fork(serverInfoSaga)]);
}
