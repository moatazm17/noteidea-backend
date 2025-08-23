import {IContent} from '../types/Content';

export type RootStackParamList = {
  MainTabs: undefined;
  Search: {
    query?: string;
  };
};

export type TabParamList = {
  Home: undefined;
  Save: undefined;
};
