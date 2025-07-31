export type Address = {
    address: string;
    balance: number;
    totalin: number;
    totalout: number;
    firstseen: Date;
};

export type PlayerAddressResponse = {
    data: Address[];
}
