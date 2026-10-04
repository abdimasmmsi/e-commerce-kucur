export const PAGE_CONTAINER_CLASS = "mx-auto w-full max-w-[1440px] min-w-0 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10";

function PageContainer({ as: Tag = "div", children, className = "", ...props }) {
  return <Tag className={`${PAGE_CONTAINER_CLASS} ${className}`} {...props}>{children}</Tag>;
}

export default PageContainer;
