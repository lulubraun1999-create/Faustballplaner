
'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Query,
  onSnapshot,
  DocumentData,
  FirestoreError,
  QuerySnapshot,
  CollectionReference,
  isEqual,
} from 'firebase/firestore';

/** Utility type to add an 'id' field to a given type T. */
export type WithId<T> = T & { id: string };

/**
 * Interface for the return value of the useCollection hook.
 * @template T Type of the document data.
 */
export interface UseCollectionResult<T> {
  data: WithId<T>[] | null; // Document data with ID, or null.
  isLoading: boolean;       // True if loading.
  error: FirestoreError | null; // Error object, or null.
}

/**
 * React hook to subscribe to a Firestore collection or query in real-time.
 * This hook is resilient to query objects being re-created on every render.
 * It only re-subscribes if the query's parameters actually change.
 *
 * @template T Optional type for document data. Defaults to any.
 * @param {CollectionReference<DocumentData> | Query<DocumentData> | null | undefined} queryOrRef -
 * The Firestore CollectionReference or Query. The hook is dormant if the value is null or undefined.
 * @returns {UseCollectionResult<T>} Object with data, isLoading, error.
 */
export function useCollection<T = any>(
  queryOrRef: CollectionReference<DocumentData> | Query<DocumentData> | null | undefined,
): UseCollectionResult<T> {
  type ResultItemType = WithId<T>;
  type StateDataType = ResultItemType[] | null;

  const [data, setData] = useState<StateDataType>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<FirestoreError | null>(null);

  // Use a ref to store the stable query. This prevents re-subscribing on every render
  // just because the parent component created a new query object.
  const stableQueryRef = useRef(queryOrRef);

  // Effect to update the stable query only when it has actually changed.
  useEffect(() => {
    if (!queryOrRef) {
      stableQueryRef.current = null;
    } else if (!stableQueryRef.current || !isEqual(stableQueryRef.current, queryOrRef)) {
      stableQueryRef.current = queryOrRef;
    }
  }, [queryOrRef]);
  
  useEffect(() => {
    const currentQuery = stableQueryRef.current;
    if (!currentQuery) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Start in a loading state whenever the query changes
    setIsLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(
      currentQuery,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const results: ResultItemType[] = [];
        for (const doc of snapshot.docs) {
          results.push({ ...(doc.data() as T), id: doc.id });
        }
        setData(results);
        setError(null);
        setIsLoading(false);
      },
      (err: FirestoreError) => {
        console.error("useCollection Firestore Error:", err);
        setError(err);
        setData(null);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [stableQueryRef.current]); // Re-run only when the stable query reference changes.

  return { data, isLoading, error };
}
