import { FaWhatsapp, FaInstagram, FaPhone } from 'react-icons/fa';

type TSocial = {
    icon: React.ReactNode;
    link: string;
    ariaLabel: string;
}

export const socials: TSocial[] = [
    {
        icon: <FaWhatsapp />,
        link: "https://wa.me/77717627077?text=%D0%97%D0%B4%D1%80%D0%B0%D0%B2%D1%81%D1%82%D0%B2%D1%83%D0%B9%D1%82%D0%B5!%0A%0A%D0%9F%D0%B8%D1%88%D1%83%20%D0%B8%D0%B7%20%D0%BF%D1%80%D0%B8%D0%BB%D0%BE%D0%B6%D0%B5%D0%BD%D0%B8%D1%8F%202%D0%93%D0%98%D0%A1.%0A%0A",
        ariaLabel: "WhatsApp",
    },
    {
        icon: <FaInstagram />,
        link: 'https://www.instagram.com/clintechkz',
        ariaLabel: "Instagram"
    },
    {
        icon: <FaPhone />,
        link: 'tel:+77717627077',
        ariaLabel: "Позвонить"
    }
]


