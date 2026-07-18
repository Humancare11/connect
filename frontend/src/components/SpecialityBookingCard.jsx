import BookingCard from "./booking/BookingCard";

function SpecialityBookingCard({ price, priceLoading, categoryId, name }) {
    const href = `/category-consultant?category=${categoryId}&specialty=${encodeURIComponent(name)}`;
    return <BookingCard price={price} priceLoading={priceLoading} ctaHref={href} />;
}

export default SpecialityBookingCard;