import MyButton from '@/components/ui/MyButton';
import Image from 'next/image';
import React from 'react'

interface IChatSelectedFileProps {
    file: File;
    index: number;
    removeFile: (index: number) => void;
}



export default function ChatSelectedFile({ file, index, removeFile }: IChatSelectedFileProps) {
    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    


    return (
        <div key={index} className="flex items-center justify-between p-2 bg-[#F9FAFB] rounded-lg">
            <div className="flex items-center gap-2">
                <Image src="/image/chat/file.svg" alt={file.name} width={20} height={20} />
                <div>
                    <p className="text-sm text-gray-700 font-medium">{file.name}</p>
                    <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                </div>
            </div>
            <MyButton
                onClick={() => removeFile(index)}
                className="text-red-500 hover:text-red-700"
            >
                <Image src="/image/chat/delete.svg" alt="delete" width={24} height={24} />
            </MyButton>
        </div>
    )
}
