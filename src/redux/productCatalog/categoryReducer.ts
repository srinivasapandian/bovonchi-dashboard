import * as T from './categoryTypes';

export interface CategoryState {
  categories: any[];
  loading: boolean;
  error: string | null;
}

const initialState: CategoryState = {
  categories: [],
  loading: false,
  error: null,
};

export default function categoryReducer(state = initialState, action: any): CategoryState {
  switch (action.type) {
    case T.FETCH_CATEGORIES_REQUEST:
      return { ...state, loading: true, error: null };
    case T.FETCH_CATEGORIES_SUCCESS:
      return { ...state, loading: false, categories: action.payload, error: null };
    case T.FETCH_CATEGORIES_FAILURE:
      return { ...state, loading: false, error: action.payload };
    default:
      return state;
  }
}
