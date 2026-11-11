import * as T from './itemTypes';

export interface ItemState {
  items: any[];
  loading: boolean;
  error: string | null;
}

const initialState: ItemState = {
  items: [],
  loading: false,
  error: null,
};

export default function itemReducer(state = initialState, action: any): ItemState {
  switch (action.type) {
    case T.FETCH_ITEMS_REQUEST:
      return { ...state, loading: true, error: null };
    case T.FETCH_ITEMS_SUCCESS:
      return { ...state, loading: false, items: action.payload, error: null };
    case T.FETCH_ITEMS_FAILURE:
      return { ...state, loading: false, error: action.payload };
    default:
      return state;
  }
}
