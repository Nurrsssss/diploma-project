// Основные хуки авторизации
export { useAuth } from './useAuth';
export { useAuthSession } from './useAuthSession';
export { useLogin } from './useLogin';
export { useLogout } from './useLogout';
export { useRegister } from './useRegister';
export { useOTP } from './useOTP';

// Типы
export type { IAuthSession } from './useAuthSession';
export type { ILoginCredentials, ILoginResult } from './useLogin';
export type { IRegisterCredentials, IRegisterResult } from './useRegister';
export type { IOTPState, ISendOTPResult, IVerifyOTPResult, IResendOTPResult } from './useOTP'; 