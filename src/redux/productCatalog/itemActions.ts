import * as T from './itemTypes';

export const fetchItemsRequest = (locationId: string) => ({
  type: T.FETCH_ITEMS_REQUEST as typeof T.FETCH_ITEMS_REQUEST,
  payload: { locationId },
});

export const fetchItemsSuccess = (data: any[]) => ({
  type: T.FETCH_ITEMS_SUCCESS as typeof T.FETCH_ITEMS_SUCCESS,
  payload: data,
});

export const fetchItemsFailure = (error: string) => ({
  type: T.FETCH_ITEMS_FAILURE as typeof T.FETCH_ITEMS_FAILURE,
  payload: error,
});
