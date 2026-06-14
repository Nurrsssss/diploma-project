interface IOption {
    label: string;
    value: string;
}

export const gender: IOption[] = [
    { label: 'Не выбрано', value: '' },
    { label: 'Мужской', value: 'male' },
    { label: 'Женский', value: 'female' },
]

export const physActivity: IOption[] = [
    { label: 'Не выбрано', value: '' },
    { label: 'Низкий', value: 'low' },
    { label: 'Средний', value: 'medium' },
    { label: 'Высокий', value: 'high' },
]

export const diets: IOption[] = [
    { label: 'Отсутствуют', value: 'отсутствует' },
    { label: 'Обычная диета', value: 'regular' },
    { label: 'Диета № 1 (при язве)', value: 'diet_1' },
    { label: 'Диета № 5 (при болезнях печени)', value: 'diet_5' },
    { label: 'Диета № 9 (при диабете)', value: 'diet_9' },
    { label: 'Безглютеновая диета', value: 'gluten_free' },
    { label: 'Безлактозная диета', value: 'lactose_free' },
    { label: 'Низкосолевая диета', value: 'low_salt' },
    { label: 'Гипоаллергенная диета', value: 'hypoallergenic' },
    { label: 'Вегетарианская', value: 'vegetarian' },
    { label: 'Веганская', value: 'vegan' },
    { label: 'Кетогенная диета', value: 'keto' },
    { label: 'Средиземноморская диета', value: 'mediterranean' },
    { label: 'DASH диета (при гипертонии)', value: 'dash' },
    { label: 'Диета FODMAP', value: 'fodmap' },
    { label: 'Палео диета', value: 'paleo' },
    { label: 'Низкоуглеводная диета', value: 'low_carb' },
    { label: 'Белковая диета', value: 'high_protein' },
    { label: 'Диета при подагре', value: 'gout_diet' },
    { label: 'Диета при почечных заболеваниях', value: 'renal_diet' },
    { label: 'Другие', value: 'other' },
]

export const diagnoses: IOption[] = [
    { label: 'Отсутствуют', value: 'отсутствует' },
    { label: 'Гипертония', value: 'hypertension' },
    { label: 'Диабет 1 типа', value: 'diabetes_type1' },
    { label: 'Диабет 2 типа', value: 'diabetes_type2' },
    { label: 'Гастрит', value: 'gastritis' },
    { label: 'Астма', value: 'asthma' },
    { label: 'Мигрень', value: 'migraine' },
    { label: 'Анемия', value: 'anemia' },
    { label: 'Остеопороз', value: 'osteoporosis' },
    { label: 'Артрит', value: 'arthritis' },
    { label: 'Депрессия', value: 'depression' },
    { label: 'Сердечная недостаточность', value: 'heart_failure' },
    { label: 'Язвенная болезнь', value: 'peptic_ulcer' },
    { label: 'Холецистит', value: 'cholecystitis' },
    { label: 'Панкреатит', value: 'pancreatitis' },
    { label: 'Пиелонефрит', value: 'pyelonephritis' },
    { label: 'Тиреотоксикоз', value: 'thyrotoxicosis' },
    { label: 'Гипотиреоз', value: 'hypothyroidism' },
    { label: 'Варикозное расширение вен', value: 'varicose_veins' },
    { label: 'Остеохондроз', value: 'osteochondrosis' },
    { label: 'Другие', value: 'other' },

]

export const allergens: IOption[] = [
    { label: 'Отсутствуют', value: 'отсутствует' },
    { label: 'Арахис', value: 'peanuts' },
    { label: 'Молочные продукты', value: 'dairy' },
    { label: 'Яйца', value: 'eggs' },
    { label: 'Рыба', value: 'fish' },
    { label: 'Морепродукты', value: 'seafood' },
    { label: 'Пшеница (глютен)', value: 'gluten' },
    { label: 'Соя', value: 'soy' },
    { label: 'Орехи', value: 'nuts' },
    { label: 'Кунжут', value: 'sesame' },
    { label: 'Цитрусовые', value: 'citrus' },
    { label: 'Пыльца растений', value: 'pollen' },
    { label: 'Пылевые клещи', value: 'dust_mites' },
    { label: 'Шерсть животных', value: 'animal_fur' },
    { label: 'Плесень', value: 'mold' },
    { label: 'Латекс', value: 'latex' },
    { label: 'Лекарственные препараты', value: 'medications' },
    { label: 'Косметика', value: 'cosmetics' },
    { label: 'Металлы (никель)', value: 'metals' },
    { label: 'Укусы насекомых', value: 'insect_bites' },
    { label: 'Другие', value: 'other' },
]