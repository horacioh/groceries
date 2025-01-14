export class ReactiveMap<K = string, V = any> {
	private data = new Map<K, V>()
	private listeners = new Map<K, Set<(value: V | undefined) => void>>()

	get(key: K): V | undefined {
		return this.data.get(key)
	}

	subscribe(key: K, fn: (value: V | undefined) => void): () => void {
		const listenerSet = this.listeners.get(key) || new Set()
		listenerSet.add(fn)
		this.listeners.set(key, listenerSet)
		// this.args.onSubscribe(key)
		return () => {
			listenerSet.delete(fn)
			// this.args.onUnsubscribe(key)
		}
	}

	private emit(key: K, value: V | undefined) {
		const listenerSet = this.listeners.get(key)
		if (!listenerSet) return
		for (const listener of listenerSet) listener(value)
	}

	write(args: { key: K; value: V | undefined }[]): void {
		// Make all writes before emitting.
		for (const { key, value } of args) {
			if (value === undefined) this.data.delete(key)
			else this.data.set(key, value)
		}

		for (const { key, value } of args) {
			this.emit(key, value)
		}
	}
}
