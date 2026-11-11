import { call, put, takeLatest } from 'redux-saga/effects';
import * as T from './categoryTypes';
import * as actions from './categoryActions';
import { fetchCategoriesApi } from './categoryApi';

function* fetchCategoriesSaga(action: ReturnType<typeof actions.fetchCategoriesRequest>) {
  try {
    const response: any = yield call(fetchCategoriesApi, action.payload.locationId);
    if (response.status === 200) {
      const data = response.data;
      // API may return array directly or nested in a data field
      const categories = Array.isArray(data) ? data : (data?.data ?? data?.categories ?? []);
      yield put(actions.fetchCategoriesSuccess(categories));
    } else {
      yield put(actions.fetchCategoriesFailure(response.data?.message || 'Failed to fetch categories'));
    }
  } catch (error: any) {
    yield put(actions.fetchCategoriesFailure(error?.message || 'Failed to fetch categories'));
  }
}

export default function* categorySaga() {
  yield takeLatest(T.FETCH_CATEGORIES_REQUEST, fetchCategoriesSaga);
}
