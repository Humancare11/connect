import BookingCard from "./booking/BookingCard";

function SpecialityBookingCard({ price, priceLoading, priceInfo, categoryId, name, isPcp = false }) {
    const href = `/category-consultant?category=${categoryId}&specialty=${encodeURIComponent(name)}${isPcp ? "&pcp=1" : ""}`;
    return <BookingCard price={price} priceLoading={priceLoading} priceInfo={priceInfo} ctaHref={href} />;
}

export default SpecialityBookingCard;