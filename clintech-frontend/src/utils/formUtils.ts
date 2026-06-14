/**
 * Преобразует значение в null если оно пустое
 * Используется для полей, которые могут быть null на сервере
 */
export const toNullIfEmpty = (value: any): any => {
  return (value && value !== '') ? value : null;
};

/**
 * Преобразует значение в пустую строку если оно пустое
 * Используется для обязательных строковых полей
 */
export const toEmptyIfEmpty = (value: any): string => {
  return (value && value !== '') ? value : '';
};

/**
 * Обеспечивает что значение является массивом
 * Если значение пустое - возвращает массив с дефолтным значением
 */
export const ensureArray = (value: any, defaultValue: string = 'отсутствует'): string[] => {
  if (Array.isArray(value)) return value.length ? value : [defaultValue];
  if (typeof value === 'string') return value ? [value] : [defaultValue];
  return [defaultValue];
};


/**
 * Преобразует значение в текст, если пустое - возвращает "Не указано"
 */
export const ensureText = (value: any): string => {
  return (value && value !== '') ? value : 'Не указано';
};

/**
 * Отображает массив в виде текста с разделителями
 * Если массив пустой или содержит только пустые значения - возвращает defaultValue
 */
export const displayArray = (value: any, defaultValue: string = 'отсутствует', separator: string = ', '): string => {
  // Сначала получаем массив через ensureArray
  const arr = ensureArray(value, defaultValue);
  
  // Фильтруем пустые значения и значения 'none'
  const filteredArr = arr.filter(item => 
    item && 
    item.trim() !== '' && 
    item.toLowerCase() !== 'none' && 
    item !== defaultValue
  );
  
  // Если после фильтрации массив пуст, возвращаем defaultValue
  if (filteredArr.length === 0) {
    return defaultValue;
  }
  
  // Соединяем элементы через разделитель
  return filteredArr.join(separator);
};

/**
 * Преобразует значение в массив
 */
export const toArray = (value: any): any[] => {
  return Array.isArray(value) ? value : value ? [value] : [];
};

/**
 * Нормализует данные формы для отправки на сервер
 * Применяет соответствующие преобразования к полям
 */
export const normalizeFormData = <T extends Record<string, any>>(
  data: T,
  fieldConfig: {
    nullFields?: (keyof T)[];
    emptyFields?: (keyof T)[];
    arrayFields?: (keyof T)[];
    textFields?: (keyof T)[];
  }
): T => {
  const result = { ...data };
  
  fieldConfig.nullFields?.forEach(field => {
    result[field] = toNullIfEmpty(result[field]) as T[keyof T];
  });
  
  fieldConfig.emptyFields?.forEach(field => {
    result[field] = toEmptyIfEmpty(result[field]) as T[keyof T];
  });
  
  fieldConfig.arrayFields?.forEach(field => {
    result[field] = ensureArray(result[field]) as T[keyof T];
  });

  fieldConfig.textFields?.forEach(field => {
    result[field] = ensureText(result[field]) as T[keyof T];
  });
  
  return result;
}; 