import * as T from './categoryTypes';

export const fetchCategoriesRequest = (locationId: string) => ({
  type: T.FETCH_CATEGORIES_REQUEST as typeof T.FETCH_CATEGORIES_REQUEST,
  payload: { locationId },
});

export const fetchCategoriesSuccess = (data: any[]) => ({
  type: T.FETCH_CATEGORIES_SUCCESS as typeof T.FETCH_CATEGORIES_SUCCESS,
  payload: data,
});

export const fetchCategoriesFailure = (error: string) => ({
  type: T.FETCH_CATEGORIES_FAILURE as typeof T.FETCH_CATEGORIES_FAILURE,
  payload: error,
});
