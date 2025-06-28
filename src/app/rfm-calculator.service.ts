import { Injectable, inject } from '@angular/core';
import { 
  Firestore,
  collection, 
  query, 
  getDocs,
  where
} from '@angular/fire/firestore';
import { Order } from '../classes/Order';
import { Customer } from '../classes/Customer';
import { RFMMetrics } from '../classes/RFM';

@Injectable({
  providedIn: 'root'
})
export class RFMCalculatorService {
  private firestore = inject(Firestore);
  
  private readonly COLLECTIONS = {
    ORDERS: 'orders',
    CUSTOMERS: 'users'
  };

  /**
   * Calculate pure RFM metrics for all customers (no scoring, no rules)
   */
  async calculateRFMMetrics(): Promise<RFMMetrics[]> {
    try {
      console.log('🚀 Starting RFM metrics calculation...');
      
      // Get all data
      const [customers, orders] = await Promise.all([
        this.getAllCustomers(),
        this.getDeliveredOrders()
      ]);

      console.log(`👥 Total customers: ${customers.length}`);
      console.log(`📦 Total delivered orders: ${orders.length}`);

      if (customers.length === 0 || orders.length === 0) {
        console.log('⚠️  No data available for RFM calculation');
        return [];
      }

      // Calculate metrics
      const rfmMetrics = this.calculateMetricsForCustomers(customers, orders);
      
      console.log(`✅ RFM metrics calculated for ${rfmMetrics.length} customers`);
      return rfmMetrics;

    } catch (error) {
      console.error('❌ Error calculating RFM metrics:', error);
      throw error;
    }
  }

  /**
   * Calculate RFM metrics for customers who have orders
   */
  private calculateMetricsForCustomers(customers: Customer[], orders: Order[]): RFMMetrics[] {
    const currentDate = new Date();
    const rfmMetrics: RFMMetrics[] = [];

    // Group orders by customer for efficient lookup
    const ordersByCustomer = this.groupOrdersByCustomer(orders);
    console.log(`🔗 Customers with orders: ${Object.keys(ordersByCustomer).length}`);

    let processedCount = 0;

    for (const customer of customers) {
      // Skip customers without valid ID
      if (!customer.id) {
        continue;
      }

      const customerId = customer.id.toString();
      const customerOrders = ordersByCustomer[customerId];

      // Skip customers without orders
      if (!customerOrders || customerOrders.length === 0) {
        continue;
      }

      processedCount++;

      // Calculate RFM values
      const metrics = this.calculateCustomerMetrics(customerOrders, currentDate);
      
      rfmMetrics.push({
        user_id: customer.id,
        recency: metrics.recency,
        frequency: metrics.frequency,
        monetary: metrics.monetary,
        rfm_score: '' // Will be assigned by K-means clustering
      });

      // Log progress every 100 customers
      if (processedCount % 100 === 0) {
        console.log(`📊 Processed ${processedCount} customers...`);
      }
    }

    console.log(`🎯 Successfully processed ${processedCount} customers`);
    return rfmMetrics;
  }

  /**
   * Group orders by customer ID for efficient lookup
   */
  private groupOrdersByCustomer(orders: Order[]): Record<string, Order[]> {
    const grouped: Record<string, Order[]> = {};

    for (const order of orders) {
      if (!order.user_id) continue;
      
      const userId = order.user_id.toString();
      if (!grouped[userId]) {
        grouped[userId] = [];
      }
      grouped[userId].push(order);
    }

    return grouped;
  }

  /**
   * Calculate pure RFM metrics for a single customer
   */
  private calculateCustomerMetrics(orders: Order[], currentDate: Date): {
    recency: number;
    frequency: number;
    monetary: number;
  } {
    // Recency: Days since last order
    const orderDates = orders.map(order => new Date(order.created_at));
    const lastOrderDate = new Date(Math.max(...orderDates.map(date => date.getTime())));
    const recency = Math.floor((currentDate.getTime() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24));

    // Frequency: Number of orders
    const frequency = orders.length;

    // Monetary: Total value of all orders
    const monetary = orders.reduce((sum, order) => sum + (order.total || 0), 0);

    return {
      recency: Math.max(0, recency), // Ensure non-negative
      frequency: Math.max(1, frequency), // Ensure at least 1
      monetary: Math.max(0, monetary) // Ensure non-negative
    };
  }

  /**
   * Get all customers from database
   */
  private async getAllCustomers(): Promise<Customer[]> {
    try {
      const q = query(collection(this.firestore, this.COLLECTIONS.CUSTOMERS));
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Customer));
    } catch (error) {
      console.error('❌ Error fetching customers:', error);
      return [];
    }
  }

  /**
   * Get only delivered orders from database
   */
  private async getDeliveredOrders(): Promise<Order[]> {
    try {
      const q = query(
        collection(this.firestore, this.COLLECTIONS.ORDERS),
        where('status', '==', 'delivered')
      );
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as unknown as Order));
    } catch (error) {
      console.error('❌ Error fetching delivered orders:', error);
      return [];
    }
  }

  /**
   * Get RFM statistics for analysis validation
   */
  async getRFMStatistics(): Promise<{
    totalCustomers: number;
    customersWithOrders: number;
    avgRecency: number;
    avgFrequency: number;
    avgMonetary: number;
    recencyRange: { min: number; max: number };
    frequencyRange: { min: number; max: number };
    monetaryRange: { min: number; max: number };
  }> {
    try {
      const metrics = await this.calculateRFMMetrics();
      
      if (metrics.length === 0) {
        return {
          totalCustomers: 0,
          customersWithOrders: 0,
          avgRecency: 0,
          avgFrequency: 0,
          avgMonetary: 0,
          recencyRange: { min: 0, max: 0 },
          frequencyRange: { min: 0, max: 0 },
          monetaryRange: { min: 0, max: 0 }
        };
      }

      const recencyValues = metrics.map(m => m.recency);
      const frequencyValues = metrics.map(m => m.frequency);
      const monetaryValues = metrics.map(m => m.monetary);

      return {
        totalCustomers: (await this.getAllCustomers()).length,
        customersWithOrders: metrics.length,
        avgRecency: Math.round(recencyValues.reduce((a, b) => a + b, 0) / metrics.length),
        avgFrequency: Math.round((frequencyValues.reduce((a, b) => a + b, 0) / metrics.length) * 10) / 10,
        avgMonetary: Math.round(monetaryValues.reduce((a, b) => a + b, 0) / metrics.length),
        recencyRange: {
          min: Math.min(...recencyValues),
          max: Math.max(...recencyValues)
        },
        frequencyRange: {
          min: Math.min(...frequencyValues),
          max: Math.max(...frequencyValues)
        },
        monetaryRange: {
          min: Math.min(...monetaryValues),
          max: Math.max(...monetaryValues)
        }
      };
    } catch (error) {
      console.error('❌ Error calculating RFM statistics:', error);
      throw error;
    }
  }

  /**
   * Validate data quality before RFM analysis
   */
  async validateDataQuality(): Promise<{
    isValid: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    try {
      const [customers, orders] = await Promise.all([
        this.getAllCustomers(),
        this.getDeliveredOrders()
      ]);

      const issues: string[] = [];
      const recommendations: string[] = [];

      // Check basic data availability
      if (customers.length === 0) {
        issues.push('No customers found in database');
        recommendations.push('Add customer data before running RFM analysis');
      }

      if (orders.length === 0) {
        issues.push('No delivered orders found in database');
        recommendations.push('Ensure orders have "delivered" status');
      }

      // Check data relationships
      if (customers.length > 0 && orders.length > 0) {
        const customerIds = new Set(customers.map(c => c.id?.toString()).filter(Boolean));
        const orderUserIds = new Set(orders.map(o => o.user_id?.toString()).filter(Boolean));
        const intersection = new Set([...customerIds].filter(id => orderUserIds.has(id)));

        if (intersection.size === 0) {
          issues.push('No customers match with order user_ids');
          recommendations.push('Check customer ID and order user_id field mapping');
        } else if (intersection.size < customerIds.size * 0.1) {
          issues.push(`Only ${intersection.size}/${customerIds.size} customers have orders`);
          recommendations.push('Consider data completeness - most customers have no orders');
        }
      }

      // Check minimum data requirements for clustering
      if (customers.length > 0 && orders.length > 0) {
        const ordersByCustomer = this.groupOrdersByCustomer(orders);
        const customersWithOrders = Object.keys(ordersByCustomer).length;

        if (customersWithOrders < 10) {
          issues.push(`Only ${customersWithOrders} customers have orders (minimum 10 recommended)`);
          recommendations.push('Need more customers with orders for meaningful clustering');
        }
      }

      return {
        isValid: issues.length === 0,
        issues,
        recommendations
      };
    } catch (error) {
      return {
        isValid: false,
        issues: ['Error validating data quality'],
        recommendations: ['Check database connection and data structure']
      };
    }
  }
}