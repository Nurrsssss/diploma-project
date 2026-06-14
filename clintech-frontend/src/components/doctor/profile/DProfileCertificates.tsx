'use client'
import NoContent from '@/components/ui/NoContent';
import { TDoctor } from '@/types/doctors';
import { Award, Shield, CheckCircle } from 'lucide-react';

interface DProfileCertificatesProps {
    doctor: TDoctor;
}

export const DProfileСertificates = ({ doctor }: DProfileCertificatesProps) => {
    return (
        <div className="bg-gradient-to-br from-white to-blue-50 rounded-2xl p-6 shadow-sm border border-blue-100">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl shadow-lg">
                    <Award className="w-6 h-6 text-white" />
                </div>
                <h2 className="font-bold text-xl text-gray-800">Сертификаты</h2>
            </div>

            <div className="space-y-4">
                {doctor.certificates && doctor.certificates.length > 0 ? (
                    doctor.certificates.map((certificate, index) => (
                        <div
                            key={index}
                            className="group relative bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md hover:border-emerald-200 transition-all duration-300"
                        >
                            <div className="flex items-start gap-4">
                                <div className="flex-shrink-0 mt-1">
                                    <div className="w-10 h-10 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-full flex items-center justify-center group-hover:from-blue-200 group-hover:to-indigo-200 transition-colors">
                                        <Shield className="w-5 h-5 text-blue-600" />
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <p className="text-gray-700 leading-relaxed font-medium">{certificate}</p>
                                </div>

                            </div>
                            <div className="absolute top-0 right-0 w-2 h-full bg-gradient-to-b from-blue-500 to-indigo-600 rounded-r-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        </div>
                    ))
                ) : (
                    <NoContent
                        title="Сертификаты не добавлены"
                        description='Добавьте сертификаты для отображения на вашем профиле'
                    />
                )}
            </div>
        </div>
    );
}; 