export class Customer {
    id: string = ""; // Thêm property id ở đây
    
    constructor(
        public user_id: string = "",
        public name: string = "",
        public email: string = "",
        public phone: string = "",
        public dob: string = "",
        public gender: string = "",
        public created_at: string = "",
        public last_login: string = "",
        public loyalty_points: number = 0,
        public address?: string
    ) {}
}