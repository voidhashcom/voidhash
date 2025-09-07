// // Ripped from https://github.com/pingdotgg/uploadthing/blob/main/packages/react/src/utils/useFetch.ts
// import { useEffect, useReducer, useRef } from 'react';
// import type { FetchEsque } from '../../core/types';
// import { safeParseJSON } from '../../core/utils';

// interface State<T> {
//   data?: T | undefined;
//   error?: Error | undefined;
// }

// type Cache<T> = Record<string, T>;

// // discriminated union type
// type Action<T> =
//   | { type: 'loading' }
//   | { type: 'fetched'; payload: T }
//   | { type: 'error'; payload: Error };

// function useFetch<T = unknown>(
//   fetch: FetchEsque,
//   url?: string,
//   options?: RequestInit
// ): State<T> {
//   const cache = useRef<Cache<T>>({});

//   // Used to prevent state update if the component is unmounted
//   const cancelRequest = useRef<boolean>(false);

//   const initialState: State<T> = {
//     error: undefined,
//     data: undefined
//   };

//   // Keep state logic separated
//   const fetchReducer = (state: State<T>, action: Action<T>): State<T> => {
//     switch (action.type) {
//       case 'loading':
//         return { ...initialState };
//       case 'fetched':
//         return { ...initialState, data: action.payload };
//       case 'error':
//         return { ...initialState, error: action.payload };
//       default:
//         return state;
//     }
//   };

//   const [state, dispatch] = useReducer(fetchReducer, initialState);

//   // biome-ignore lint/correctness/useExhaustiveDependencies: ok
//   useEffect(() => {
//     // Do nothing if the url is not given
//     if (!url) {
//       return;
//     }

//     cancelRequest.current = false;

//     const fetchData = async () => {
//       dispatch({ type: 'loading' });

//       // If a cache exists for this url, return it
//       if (cache.current[url]) {
//         dispatch({ type: 'fetched', payload: cache.current[url] });
//         return;
//       }

//       try {
//         const response = await fetch(url, options);
//         if (!response.ok) {
//           if (response.status >= 400) {
//             // biome-ignore lint/suspicious/noExplicitAny: ok
//             const error: any = await response.json();
//             throw new VoidhashError(
//               'API_ERROR',
//               new Error(error.error.message || 'Unknown error')
//             );
//           }
//           throw new VoidhashError(
//             'NETWORK_ERROR',
//             new Error(response.statusText)
//           );
//         }

//         const dataOrError = await safeParseJSON<T>(response);
//         if (dataOrError instanceof Error) {
//           throw dataOrError;
//         }

//         cache.current[url] = dataOrError;
//         if (cancelRequest.current) {
//           return;
//         }

//         dispatch({ type: 'fetched', payload: dataOrError });
//       } catch (error) {
//         if (cancelRequest.current) {
//           return;
//         }

//         dispatch({ type: 'error', payload: error as Error });
//       }
//     };

//     fetchData();

//     // Use the cleanup function for avoiding a possibly...
//     // ...state update after the component was unmounted
//     return () => {
//       cancelRequest.current = true;
//     };
//   }, [url]);

//   return state;
// }

// export default useFetch;
