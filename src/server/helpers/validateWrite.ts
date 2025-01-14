import { compact, omit, uniq } from "lodash"
import { getRecordMap } from "../../shared/recordMapHelpers"
import {
	MessageRecord,
	RecordMap,
	RecordPointer,
	RecordTable,
	RecordValue,
	ThreadRecord,
	UserRecord,
	UserSettingsRecord,
} from "../../shared/schema"

export function validateWrite(args: {
	pointers: RecordPointer[]
	beforeRecordMap: RecordMap
	afterRecordMap: RecordMap
	userId: string
}) {
	const { pointers, beforeRecordMap, afterRecordMap, userId } = args
	const errors = compact(
		pointers.map((pointer) => {
			const validateRecordWrite = validateWriteMap[pointer.table]
			// @ts-ignore
			return validateRecordWrite({ pointer, beforeRecordMap, afterRecordMap, userId })
		})
	)
	return errors
}

const validateWriteMap: {
	[T in RecordTable]: (args: {
		pointer: RecordPointer<T>
		beforeRecordMap: RecordMap
		afterRecordMap: RecordMap
		userId: string
	}) => string | undefined
} = {
	user: validateWriteUser,
	user_settings: validateWriteUserSettings,
	thread: validateWriteThread,
	message: validateWriteMessage,
	password: () => "Users cannot write to this table.",
	auth_token: () => "Users cannot write to this table.",
	file: validateWriteFile,
}

const editableMessageProperties: (keyof MessageRecord)[] = ["version", "updated_at", "text"]

function validateWriteMessage(args: {
	pointer: RecordPointer<"message">
	beforeRecordMap: RecordMap
	afterRecordMap: RecordMap
	userId: string
}) {
	const { pointer, beforeRecordMap, afterRecordMap, userId } = args
	const before = getRecordMap(beforeRecordMap, pointer)
	const after = getRecordMap(afterRecordMap, pointer)

	if (!before && after) {
		// Created.
		if (after.author_id !== userId) return "You cannot create a message that you did not author."

		const thread = getRecordMap(afterRecordMap, { table: "thread", id: after.thread_id })
		if (!thread) return "Message thread not found."
		if (!thread.member_ids.includes(userId))
			return "You must be a member of this thread to post a message."
	}

	if (before && after) {
		// Updated.
		if (after.author_id !== userId) return "You cannot edit a message you did not author."

		const error = validateEditableProperties({
			table: "message",
			before,
			after,
			properties: editableMessageProperties,
		})
		if (error) return error
	}

	if (before && !after) {
		// Deleted.
		if (before.author_id !== userId) return "You cannot delete a message you did not author."

		const thread = getRecordMap(afterRecordMap, { table: "thread", id: before.thread_id })
		if (!thread) return "Message thread not found."
		if (!thread.member_ids.includes(userId))
			return "You must be a member of this thread to post a message."
	}
}

const editableThreadProperties: (keyof ThreadRecord)[] = [
	"version",
	"updated_at",
	"member_ids",
	"replied_at",
	"subject",
]

function validateWriteThread(args: {
	pointer: RecordPointer<"thread">
	beforeRecordMap: RecordMap
	afterRecordMap: RecordMap
	userId: string
}) {
	const { pointer, beforeRecordMap, afterRecordMap, userId } = args
	const before = getRecordMap(beforeRecordMap, pointer)
	const after = getRecordMap(afterRecordMap, pointer)

	if (!before && after) {
		// Created.
		if (after.created_by !== userId) return "You cannot create a thread created_by someone else."
	}

	if (before && after) {
		// Updated.
		// if (after.created_by !== userId) return "You cannot edit a thread you did not create."
		if (!userId) return "You must be logged in to edit a thread."
		if (!before.member_ids.includes(userId))
			return "You must be a member of this thread to post a message."

		const error = validateEditableProperties({
			table: "thread",
			before,
			after,
			properties: editableThreadProperties,
		})
		if (error) return error
	}

	if (before && !after) {
		// Deleted.
		if (before.created_by !== userId) return "You cannot delete a thread created_by someone else."
	}
}

const editableUserProperties: (keyof UserRecord)[] = ["version", "updated_at", "username"]

function validateWriteUser(args: {
	pointer: RecordPointer<"user">
	beforeRecordMap: RecordMap
	afterRecordMap: RecordMap
	userId: string
}) {
	const { pointer, beforeRecordMap, afterRecordMap, userId } = args
	const before = getRecordMap(beforeRecordMap, pointer)
	const after = getRecordMap(afterRecordMap, pointer)

	if (!before && after) {
		// Created.
		return "You cannot create create new users."
	}

	if (before && after) {
		// Updated.
		if (after.id !== userId) return "You can't edit someone else's user record."

		const error = validateEditableProperties({
			table: "user",
			before,
			after,
			properties: editableUserProperties,
		})
		if (error) return error
	}

	if (before && !after) {
		// Deleted.
		return "You cannot delete a user."
	}
}

const editableUserSettingsProperties: (keyof UserSettingsRecord)[] = ["version", "updated_at"]

function validateWriteUserSettings(args: {
	pointer: RecordPointer<"user_settings">
	beforeRecordMap: RecordMap
	afterRecordMap: RecordMap
	userId: string
}) {
	const { pointer, beforeRecordMap, afterRecordMap, userId } = args
	const before = getRecordMap(beforeRecordMap, pointer)
	const after = getRecordMap(afterRecordMap, pointer)

	if (!before && after) {
		// Created.
		return "You cannot create create new user settings."
	}

	if (before && after) {
		// Updated.
		if (after.id !== userId) return "You can't edit someone else's user settings record."

		const error = validateEditableProperties({
			table: "user_settings",
			before,
			after,
			properties: editableUserSettingsProperties,
		})
		if (error) return error
	}

	if (before && !after) {
		// Deleted.
		return "You cannot delete user_settings."
	}
}

function validateEditableProperties<T extends RecordTable>(args: {
	table: T
	before: RecordValue<T>
	after: RecordValue<T>
	properties: (keyof RecordValue<T>)[]
}) {
	const { table, before, after, properties } = args
	const beforeConst = omit(before, properties)
	const afterConst = omit(before, properties)
	const keys = uniq([...Object.keys(beforeConst), ...Object.keys(after)])
	for (const key of keys) {
		if (beforeConst[key] !== afterConst[key]) {
			return `Not allowed to edit ${table}.${key}`
		}
	}
}

function validateWriteFile(args: {
	pointer: RecordPointer<"file">
	beforeRecordMap: RecordMap
	afterRecordMap: RecordMap
	userId: string
}) {
	const { pointer, beforeRecordMap, afterRecordMap, userId } = args
	const before = getRecordMap(beforeRecordMap, pointer)
	const after = getRecordMap(afterRecordMap, pointer)

	if (!after) return "You cannot hard delete a file."
	if (after.owner_id !== userId) return "You must be the owner of the file."
	if (before && before.owner_id !== after.owner_id) return "Can't change file owners."
	if (before && before.filename !== after.filename) return "Can't change filename."

	const parentPointer =
		after.parent_table && after.parent_id
			? { table: after.parent_table, id: after.parent_id }
			: undefined

	if (parentPointer) {
		const error = validateWriteMap[parentPointer.table]({
			// @ts-ignore
			pointer: parentPointer,
			beforeRecordMap,
			afterRecordMap,
			userId,
		})
		if (error) return error
	}
}
