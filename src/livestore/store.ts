import { makePersistedAdapter } from '@livestore/adapter-web'
import LiveStoreSharedWorker from '@livestore/adapter-web/shared-worker?sharedworker'
import { getStore } from '@livestore/solid'

import LiveStoreWorker from '../livestore.worker.ts?worker'
import { schema } from './schema.ts'

const resetPersistence =
  import.meta.env.DEV &&
  new URLSearchParams(window.location.search).get('reset') !== null

if (resetPersistence) {
  const searchParams = new URLSearchParams(window.location.search)
  searchParams.delete('reset')
  window.history.replaceState(
    null,
    '',
    `${window.location.pathname}?${searchParams.toString()}`,
  )
}

const adapterFactory = makePersistedAdapter({
  storage: { type: 'opfs' },
  worker: LiveStoreWorker,
  sharedWorker: LiveStoreSharedWorker,
  resetPersistence,
})

export const store = await getStore<typeof schema>({
  adapter: adapterFactory,
  schema,
  storeId: 'aoc-tracker',
})
