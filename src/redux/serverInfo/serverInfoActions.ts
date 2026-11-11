import * as T from './serverInfoTypes';

export const fetchServerInfoRequest = () => ({
  type: T.FETCH_SERVER_INFO_REQUEST as typeof T.FETCH_SERVER_INFO_REQUEST,
});

export const fetchServerInfoSuccess = (serverKnownSalt: string) => ({
  type: T.FETCH_SERVER_INFO_SUCCESS as typeof T.FETCH_SERVER_INFO_SUCCESS,
  payload: serverKnownSalt,
});

export const fetchServerInfoFailure = (error: string) => ({
  type: T.FETCH_SERVER_INFO_FAILURE as typeof T.FETCH_SERVER_INFO_FAILURE,
  payload: error,
});

export const clearServerInfo = () => ({
  type: T.CLEAR_SERVER_INFO as typeof T.CLEAR_SERVER_INFO,
});

export type ServerInfoAction =
  | ReturnType<typeof fetchServerInfoRequest>
  | ReturnType<typeof fetchServerInfoSuccess>
  | ReturnType<typeof fetchServerInfoFailure>
  | ReturnType<typeof clearServerInfo>;
