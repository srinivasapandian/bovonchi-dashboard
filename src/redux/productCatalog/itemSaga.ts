import { call, put, takeLatest } from 'redux-saga/effects';
import * as T from './itemTypes';
import * as actions from './itemActions';
import { fetchItemsApi } from './itemApi';

function* fetchItemsSaga(action: ReturnType<typeof actions.fetchItemsRequest>) {
  try {
    const response: any = yield call(fetchItemsApi, action.payload.locationId);
    if (response.status === 200) {
      const data = response.data;
      const items = Array.isArray(data) ? data : (data?.data ?? data?.items ?? []);
      yield put(actions.fetchItemsSuccess(items));
    } else {
      yield put(actions.fetchItemsFailure(response.data?.message || 'Failed to fetch items'));
    }
  } catch (error: any) {
    yield put(actions.fetchItemsFailure(error?.message || 'Failed to fetch items'));
  }
}

export default function* itemSaga() {
  yield takeLatest(T.FETCH_ITEMS_REQUEST, fetchItemsSaga);
}
