
export class Order {
constructor(
    public order_id: string,
    public created_at: string,
    public status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled',
    public store_id: string,
    public buy_at: 'online store' | 'offline store',
    public customer_name: string,
    public customer_phone: string,
    public customer_address: string,
    public payment_method: string,
    public shipping_fee: number,
    public total: number,
    public user_id: string,
    public voucher_code?: string,
    public voucher_discount?: number
  ) {}
}