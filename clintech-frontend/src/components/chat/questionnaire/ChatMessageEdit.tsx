import React from 'react'

interface IChatMessageEditProps {
    style: string;
    editText: string;
    setEditText: (text: string) => void;
    onEditCancel: () => void;
    handleSave: () => void;
}
export default function ChatMessageEdit({ style, editText, setEditText, onEditCancel, handleSave }: IChatMessageEditProps) {
    return (
        <div className={`${style} flex flex-col gap-2 w-full max-w-[92%] sm:max-w-[85%]`}>
            <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="p-2 rounded-lg bg-white/10 text-white border border-white/20 focus:outline-none focus:border-white/40"
                rows={5}
            />
            <div className="flex justify-end gap-2">
                <button
                    onClick={onEditCancel}
                    className="px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white text-sm"
                >
                    Отмена
                </button>
                <button
                    onClick={handleSave}
                    className="px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white text-sm"
                >
                    Сохранить
                </button>
            </div>
        </div>
    )
}
