export class Feedback {
  constructor(
    public feedback_id: string,
    public user_id: number = 0,
    public product_id: number = 0,
    public content: string = '',
    public ratings: number = 0,
    public created_at: string = ''
  ) {}
}
