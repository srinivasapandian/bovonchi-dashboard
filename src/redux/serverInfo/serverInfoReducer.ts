import { SERVER_KNOWN_SALT } from '../../constants';
import * as T from './serverInfoTypes';
import type { ServerInfoAction } from './serverInfoActions';

export interface ServerInfoState {
  serverKnownSalt: string | null;
  loading: boolean;
  error: string | null;
}

function getInitialServerKnownSalt(): string | null {
  try {
    const stored = localStorage.getItem(SERVER_KNOWN_SALT);
    return stored && stored.trim() ? stored.trim() : null;
  } catch {
    return null;
  }
}

const initialState: ServerInfoState = {
  serverKnownSalt: getInitialServerKnownSalt(),
  loading: false,
  error: null,
};

export default function serverInfoReducer(
  state = initialState,
  action: ServerInfoAction,
): ServerInfoState {
  switch (action.type) {
    case T.FETCH_SERVER_INFO_REQUEST:
      return { ...state, loading: true, error: null };
    case T.FETCH_SERVER_INFO_SUCCESS:
      return { ...state, loading: false, serverKnownSalt: action.payload, error: null };
    case T.FETCH_SERVER_INFO_FAILURE:
      return { ...state, loading: false, error: action.payload };
    case T.CLEAR_SERVER_INFO:
      return { ...state, serverKnownSalt: null, loading: false, error: null };
    default:
      return state;
  }
}
