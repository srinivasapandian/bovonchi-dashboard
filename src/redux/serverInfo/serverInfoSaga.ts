import { call, put, takeLatest } from 'redux-saga/effects';
import { SERVER_KNOWN_SALT } from '../../constants';
import { initHmac } from '../../utils/hmac-utils';
import { fetchServerInfoApi } from '../../services/serverInfoApi';
import * as T from './serverInfoTypes';
import * as actions from './serverInfoActions';

function* fetchServerInfoSaga() {
  try {
    const serverKnownSalt: string = yield call(fetchServerInfoApi);

    localStorage.setItem(SERVER_KNOWN_SALT, serverKnownSalt);
    yield put(actions.fetchServerInfoSuccess(serverKnownSalt));
    yield call(initHmac);
  } catch (error: any) {
    yield put(actions.fetchServerInfoFailure(error?.message || 'Failed to fetch server info'));
  }
}

export default function* serverInfoSaga() {
  yield takeLatest(T.FETCH_SERVER_INFO_REQUEST, fetchServerInfoSaga);
}
