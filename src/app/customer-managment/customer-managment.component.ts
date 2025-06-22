import { Component, OnInit } from '@angular/core';
import { Firestore, collection, collectionData, deleteDoc, doc, updateDoc } from '@angular/fire/firestore';

export class Customer {
  constructor(
    public user_id: string,
    public name: string = '',
    public email: string = '',
    public phone: string = '',
    public dob: string = '',
    public gender: string = '',
    public created_at: string = '',
    public last_login: string = '',
    public loyalty_points: number = 0,
    public address?: string
  ) {}
}

interface ColumnFilter {
  searchTerm: string;
  selectedValues: Set<string>;
  isDropdownOpen: boolean;
  uniqueValues: string[];
}

@Component({
  selector: 'app-customer-managment',
  standalone: false,
  templateUrl: './customer-managment.component.html',
  styleUrl: './customer-managment.component.css'
})
export class CustomerManagmentComponent implements OnInit {
  customers: Customer[] = [];
  filteredCustomers: Customer[] = [];
  searchTerm: string = '';
  loading: boolean = false;
  error: string | null = null;

  isModalOpen: boolean = false;
  selectedCustomer: Customer | null = null;
  editingCustomer: Customer | null = null;
  isEditing: boolean = false;

  filters: { [key: string]: ColumnFilter } = {
    user_id: this.initFilter(),
    name: this.initFilter(),
    email: this.initFilter(),
    phone: this.initFilter(),
    gender: this.initFilter(),
    loyalty_points: this.initFilter(),
    address: this.initFilter(),
  };

  constructor(private firestore: Firestore) {}

  ngOnInit(): void {
    this.loading = true;
    const customerRef = collection(this.firestore, 'users');

    collectionData(customerRef, { idField: 'user_id' }).subscribe({
      next: (data: any[]) => {
        this.customers = data.map(user => new Customer(
          user.user_id,
          user.name,
          user.email,
          user.phone,
          user.dob,
          user.gender,
          this.formatFirestoreDate(user.created_at),
          this.formatFirestoreDate(user.last_login),
          user.loyalty_points,
          user.address
        ));
        this.initializeFilters();
        this.applyFilters();
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load customers';
        this.loading = false;
        console.error(err);
      }
    });
  }

  parseFirestoreDate(input: any): Date | null {
    if (!input) return null;
    if (input.toDate) return input.toDate();
    if (input.seconds) return new Date(input.seconds * 1000);
    const parsed = new Date(input);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  formatFirestoreDate(input: any): string {
    const date = this.parseFirestoreDate(input);
    if (!date) return '';
    return date.toLocaleDateString('vi-VN') + ' ' + date.toLocaleTimeString('vi-VN');
  }

  formatDateForInput(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  }

  initFilter(): ColumnFilter {
    return {
      searchTerm: '',
      selectedValues: new Set(),
      isDropdownOpen: false,
      uniqueValues: []
    };
  }

  normalizeVietnameseText(text: string): string {
    return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd');
  }

  openModal(customer: Customer): void {
    this.selectedCustomer = { ...customer }; // Deep copy
    this.editingCustomer = { ...customer }; // Deep copy
    this.isModalOpen = true;
    this.isEditing = false;
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.selectedCustomer = null;
    this.editingCustomer = null;
    this.isEditing = false;
  }

  toggleEdit(): void {
    this.isEditing = !this.isEditing;
    if (!this.isEditing && this.selectedCustomer) {
      // Reset về dữ liệu gốc khi hủy edit
      this.editingCustomer = { ...this.selectedCustomer };
    }
  }

  async saveCustomer(): Promise<void> {
    if (this.editingCustomer && this.selectedCustomer) {
      try {
        // Cập nhật dữ liệu local
        const index = this.customers.findIndex(c => c.user_id === this.selectedCustomer!.user_id);
        if (index !== -1) {
          // Cập nhật customer trong array
          this.customers[index] = { ...this.editingCustomer };
          // Cập nhật selectedCustomer để hiển thị dữ liệu mới
          this.selectedCustomer = { ...this.editingCustomer };
          
          // Refresh filters và filtered customers
          this.initializeFilters();
          this.applyFilters();
        }

        // Chuẩn bị dữ liệu để update Firestore
        const userRef = doc(this.firestore, `users/${this.selectedCustomer.user_id}`);
        const dataToUpdate = this.removeUndefinedFields(this.editingCustomer);

        console.log('📦 Customer data to update:', dataToUpdate);

        // Update Firestore
        await updateDoc(userRef, dataToUpdate);
        console.log('✅ Customer updated successfully');
        
        // Tắt chế độ editing
        this.isEditing = false;
        
        // Hiển thị thông báo thành công
        alert('Cập nhật thông tin khách hàng thành công!');
        
      } catch (error) {
        console.error('❌ Error updating customer:', error);
        alert('Có lỗi xảy ra khi cập nhật thông tin khách hàng');
      }
    }
  }

  removeUndefinedFields(obj: any): any {
    return Object.fromEntries(
      Object.entries(obj).filter(([_, value]) => value !== undefined)
    );
  }

  deleteCustomerFromModal(): void {
    if (this.selectedCustomer && confirm('Bạn có chắc chắn muốn xóa khách hàng này?')) {
      this.deleteCustomer(this.selectedCustomer.user_id);
      this.closeModal();
    }
  }

  async deleteCustomer(customerId: string): Promise<void> {
    try {
      // Xóa khỏi local array
      this.customers = this.customers.filter(c => c.user_id !== customerId);
      this.initializeFilters();
      this.applyFilters();

      // Xóa khỏi Firestore
      const userRef = doc(this.firestore, `users/${customerId}`);
      await deleteDoc(userRef);
      console.log('✅ Customer deleted successfully');
      alert('Xóa khách hàng thành công!');
    } catch (error) {
      console.error('❌ Error deleting customer:', error);
      alert('Có lỗi xảy ra khi xóa khách hàng');
    }
  }

  initializeFilters() {
    const keys = Object.keys(this.filters);
    for (let key of keys) {
      this.filters[key].uniqueValues = [...new Set(this.customers.map(c => this.getCustomerValue(c, key)))];
      this.filters[key].selectedValues = new Set(this.filters[key].uniqueValues);
    }
  }

  getCustomerValue(customer: Customer, column: string): string {
    switch (column) {
      case 'user_id': return customer.user_id?.toString() || '';
      case 'name': return customer.name || '';
      case 'email': return customer.email || '';
      case 'phone': return customer.phone || '';
      case 'gender': return customer.gender || '';
      case 'loyalty_points': return customer.loyalty_points?.toString() || '';
      case 'address': return customer.address || '';
      default: return '';
    }
  }

  applyFilters() {
    this.filteredCustomers = this.customers.filter(customer => {
      return Object.keys(this.filters).every(column => {
        const value = this.getCustomerValue(customer, column);
        return this.filters[column].selectedValues.has(value);
      });
    });
  }

  viewCustomerDetails(customer: Customer): void {
    this.openModal(customer);
  }

  toggleFilterDropdown(column: string, event: Event) {
    event.stopPropagation();
    Object.keys(this.filters).forEach(key => this.filters[key].isDropdownOpen = key === column ? !this.filters[key].isDropdownOpen : false);
  }

  closeAllDropdowns() {
    Object.keys(this.filters).forEach(key => this.filters[key].isDropdownOpen = false);
  }

  onSearchChange(column: string, searchTerm: string) {
    this.filters[column].searchTerm = searchTerm;
    this.applyFilters();
  }

  toggleValue(column: string, value: string) {
    const selected = this.filters[column].selectedValues;
    selected.has(value) ? selected.delete(value) : selected.add(value);
    this.applyFilters();
  }

  selectAll(column: string) {
    this.filters[column].selectedValues = new Set(this.getFilteredUniqueValues(column));
    this.applyFilters();
  }

  deselectAll(column: string) {
    this.filters[column].selectedValues.clear();
    this.applyFilters();
  }

  getFilteredUniqueValues(column: string): string[] {
    const searchTerm = this.normalizeVietnameseText(this.filters[column].searchTerm);
    return this.filters[column].uniqueValues.filter(value => this.normalizeVietnameseText(value).includes(searchTerm));
  }

  clearFilter(column: string) {
    this.filters[column].searchTerm = '';
    this.filters[column].selectedValues = new Set(this.filters[column].uniqueValues);
    this.applyFilters();
  }

  hasActiveFilter(column: string): boolean {
    return this.filters[column].selectedValues.size !== this.filters[column].uniqueValues.length;
  }
}