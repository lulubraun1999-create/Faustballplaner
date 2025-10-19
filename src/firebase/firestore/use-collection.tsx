
'use client';

import { useState, useEffect } from 'react';
import {
  Query,
  onSnapshot,
  DocumentData,
  FirestoreError,
  QuerySnapshot,
  CollectionReference,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

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

  useEffect(() => {
    // If the query is null or undefined, do nothing.
    if (!queryOrRef) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Start in a loading state and clear previous errors.
    setIsLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(
      queryOrRef,
      (snapshot: QuerySnapshot<DocumentData>) => {
        // Map snapshot docs to the desired data format.
        const results: ResultItemType[] = snapshot.docs.map(doc => ({
          ...(doc.data() as T),
          id: doc.id,
        }));
        
        setData(results);
        setError(null);
        setIsLoading(false);
      },
      (err: FirestoreError) => {
        // Create and emit a rich, contextual error for permission issues.
        const permissionError = new FirestorePermissionError({
          path: queryOrRef.path,
          operation: 'list',
        });
        errorEmitter.emit('permission-error', permissionError);
        
        // Also set local error state for component-level handling if needed.
        setError(err);
        setData(null);
        setIsLoading(false);
      }
    );

    // Cleanup the listener when the component unmounts or the query changes.
    return () => unsubscribe();
  }, [queryOrRef]); // Effect dependencies.

  return { data, isLoading, error };
}
