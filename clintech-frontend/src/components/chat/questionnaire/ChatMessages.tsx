import React, { useEffect, useRef } from 'react';
import { TQuestionnaireMessage } from '@/types/questionnaire';
import ChatMessage from './ChatMessage';

interface IChatMessagesProps {
    messages: TQuestionnaireMessage[];
    onEditMessage: (messageId: string, newText: string) => void;
    editingMessageId: string | null;
    setEditingMessageId: (id: string | null) => void;
}

const ChatMessages: React.FC<IChatMessagesProps> = ({
    messages,
    onEditMessage,
    editingMessageId,
    setEditingMessageId
}) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        const timeout = setTimeout(() => {
            scrollToBottom();
        }, 0);

        return () => clearTimeout(timeout);
    }, [messages]);

    return (
        <div className="flex-1 min-h-[calc(100vh-100px)] overflow-y-auto p-2 sm:p-4 space-y-3 sm:space-y-4 pb-32 sm:pb-32">
            {(() => {
                let receiverIndex = 0;
                return messages.map((msg) => {
                    let indexForMsg = null;
                    if (msg.type === 'receiver') {
                        receiverIndex += 1;
                        indexForMsg = receiverIndex;
                    }
                    return (
                        <div
                            key={msg.id}
                            className={`flex ${msg.type === 'sender' ? 'justify-end' : 'justify-start'}`}
                        >
                            <ChatMessage
                                index={indexForMsg || 0}
                                text={msg.text}
                                type={msg.type}
                                id={msg.id}
                                isEditing={editingMessageId === msg.id}
                                onEdit={onEditMessage}
                                onEditStart={() => setEditingMessageId(msg.id)}
                                onEditCancel={() => setEditingMessageId(null)}
                            />
                        </div>
                    );
                });
            })()}
            <div ref={messagesEndRef} />
        </div>
    );
};

export default ChatMessages;
