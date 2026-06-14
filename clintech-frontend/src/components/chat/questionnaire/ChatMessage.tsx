import React, { useState } from 'react';
import ChatMessageEdit from './ChatMessageEdit';

interface IChatMessageProps {
    index: number;
    text: string;
    type: 'sender' | 'receiver';
    id: string;
    isEditing: boolean;
    onEdit: (messageId: string, newText: string) => void;
    onEditStart: () => void;
    onEditCancel: () => void;
}


const ChatMessage: React.FC<IChatMessageProps> = ({
    index,
    text,
    type,
    id,
    isEditing,
    onEdit,
    onEditStart,
    onEditCancel
}) => {
    const [editText, setEditText] = useState(text);

    const handleSave = () => {
        onEdit(id, editText);
    };

    const commonStyle = 'text-base rounded-lg p-2 sm:p-4 max-w-[100%] sm:max-w-[100%] break-words whitespace-pre-wrap min-w-[120px]';
    const style = type === 'sender' ?
        `${commonStyle} ml-auto bg-primary text-white` :
        `${commonStyle} bg-[#F9FAFB] text-black mr-auto shadow`;

    if (isEditing) {
        return (
            <ChatMessageEdit
                style={style}
                editText={editText}
                setEditText={setEditText}
                onEditCancel={onEditCancel}
                handleSave={handleSave}
            />
        );
    }

    return (
        <div className="flex flex-col items-end">
            <div className={style}>
                <p className="">
                    {type === 'receiver' && index && (
                        <span className="inline-block mr-2 font-bold text-primary">{index}.</span>
                    )}
                    <span className='font-sans font-medium break-words whitespace-pre-wrap'>{text}</span>
                </p>
            </div>
            {type === 'sender' && (
                <button
                    onClick={onEditStart}
                    className="text-sm text-gray-500 hover:text-gray-700 mt-1"
                >
                    Редактировать
                </button>
            )}
        </div>
    );
};

export default ChatMessage;
