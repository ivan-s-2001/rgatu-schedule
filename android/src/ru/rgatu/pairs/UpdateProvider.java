package ru.rgatu.pairs;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import java.io.File;
import java.io.FileNotFoundException;

/** Grants the system installer read access to one verified update, never to other files. */
public final class UpdateProvider extends ContentProvider {
    @Override public boolean onCreate() { return true; }
    @Override public String getType(Uri uri) { return "application/vnd.android.package-archive"; }
    private File apk(Uri uri) throws FileNotFoundException {
        if (!"ru.rgatu.pairs.updates".equals(uri.getAuthority()) || !"/apk".equals(uri.getPath())) throw new FileNotFoundException();
        return new File(getContext().getCacheDir(),"rgatu-update.apk");
    }
    @Override public ParcelFileDescriptor openFile(Uri uri,String mode) throws FileNotFoundException {
        if (!"r".equals(mode)) throw new FileNotFoundException();
        return ParcelFileDescriptor.open(apk(uri),ParcelFileDescriptor.MODE_READ_ONLY);
    }
    @Override public Cursor query(Uri uri,String[] projection,String selection,String[] arguments,String order) {
        try {
            File file=apk(uri);
            String[] columns=projection==null ? new String[]{OpenableColumns.DISPLAY_NAME,OpenableColumns.SIZE} : projection;
            MatrixCursor cursor=new MatrixCursor(columns);
            Object[] values=new Object[columns.length];
            for (int index=0;index<columns.length;index++) {
                if (OpenableColumns.DISPLAY_NAME.equals(columns[index])) values[index]="РГАТУ Пары.apk";
                if (OpenableColumns.SIZE.equals(columns[index])) values[index]=file.length();
            }
            cursor.addRow(values);
            return cursor;
        } catch (FileNotFoundException exception) { return null; }
    }
    @Override public Uri insert(Uri uri,ContentValues values) { throw new UnsupportedOperationException(); }
    @Override public int update(Uri uri,ContentValues values,String selection,String[] arguments) { throw new UnsupportedOperationException(); }
    @Override public int delete(Uri uri,String selection,String[] arguments) { throw new UnsupportedOperationException(); }
}
